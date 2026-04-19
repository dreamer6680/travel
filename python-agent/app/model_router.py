from __future__ import annotations

import json
import logging
import time
from typing import Any, AsyncGenerator, Dict, List

import httpx

from .config import settings

logger = logging.getLogger(__name__)


def _client_timeout(read_seconds: float) -> httpx.Timeout:
    """读响应阶段单独放宽，避免大 JSON 润色时 60~120s 不够。"""
    return httpx.Timeout(
        connect=20.0,
        read=read_seconds,
        write=120.0,
        pool=20.0,
    )


async def _raise_for_ollama_chat(response: httpx.Response) -> None:
    """Ollama 对未知模型常返回 404，与「接口不存在」易混淆，这里单独说明。"""
    if response.status_code == 404:
        try:
            body = (response.text or "")[:400]
        except Exception:
            body = ""
        raise RuntimeError(
            f"Ollama /api/chat 返回 404：本机可能没有聊天模型 {settings.ollama_chat_model!r}。"
            f"请执行: ollama pull {settings.ollama_chat_model}，或设置环境变量 OLLAMA_CHAT_MODEL 为 `ollama list` 中已有名称。"
            f" 响应片段: {body}"
        )
    response.raise_for_status()


async def _raise_for_ollama_stream(response: httpx.Response) -> None:
    if response.status_code == 404:
        body = (await response.aread()).decode(errors="replace")[:400]
        raise RuntimeError(
            f"Ollama /api/chat 返回 404：本机可能没有聊天模型 {settings.ollama_chat_model!r}。"
            f"请执行: ollama pull {settings.ollama_chat_model}，或设置 OLLAMA_CHAT_MODEL。响应片段: {body}"
        )
    response.raise_for_status()


class ModelRouter:
    def __init__(self) -> None:
        self.provider = settings.llm_provider
        self.fallback_provider = settings.llm_fallback_provider
        self.timeout = settings.request_timeout_seconds

    async def chat_once(
        self,
        messages: List[Dict[str, str]],
        provider: str | None = None,
        *,
        read_timeout: float | None = None,
    ) -> str:
        active_provider = provider or self.provider
        if active_provider == "openai":
            return await self._openai_chat(messages, read_timeout=read_timeout)
        return await self._ollama_chat(messages, read_timeout=read_timeout)

    async def chat_with_fallback(
        self,
        messages: List[Dict[str, str]],
        *,
        read_timeout: float | None = None,
    ) -> str:
        read_s = float(read_timeout if read_timeout is not None else self.timeout)
        try:
            return await self.chat_once(messages, self.provider, read_timeout=read_timeout)
        except Exception as primary_exc:
            if not self.fallback_provider or self.fallback_provider == self.provider:
                raise
            try:
                out = await self.chat_once(
                    messages, self.fallback_provider, read_timeout=read_timeout
                )
            except Exception as fb_exc:
                # 用 repr：避免 str(Exception) 为空（如裸 Exception()、部分 CancelledError）
                logger.warning(
                    "主 LLM 失败详情 provider=%s read_timeout=%.1fs err=%r",
                    self.provider,
                    read_s,
                    primary_exc,
                )
                raise RuntimeError(
                    f"主 LLM ({self.provider}) 失败: {primary_exc!r}; "
                    f"回退 ({self.fallback_provider}) 失败: {fb_exc!r}"
                ) from fb_exc
            logger.warning(
                "主 LLM (%s) 失败，已使用回退 (%s)。主因: %r",
                self.provider,
                self.fallback_provider,
                primary_exc,
            )
            return out

    async def stream_chat_with_fallback(
        self, messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        primary_exc: Exception | None = None
        try:
            async for line in self._stream_chat(messages, self.provider):
                yield line
            return
        except Exception as e:
            primary_exc = e
        if not self.fallback_provider or self.fallback_provider == self.provider:
            assert primary_exc is not None
            raise primary_exc
        logger.warning(
            "流式主 LLM (%s) 失败，切换回退 (%s): %s",
            self.provider,
            self.fallback_provider,
            primary_exc,
        )
        async for line in self._stream_chat(messages, self.fallback_provider):
            yield line

    async def _stream_chat(
        self, messages: List[Dict[str, str]], provider: str
    ) -> AsyncGenerator[str, None]:
        if provider == "openai":
            async for line in self._stream_openai(messages):
                yield line
            return
        async for line in self._stream_ollama(messages):
            yield line

    async def _ollama_chat(
        self, messages: List[Dict[str, str]], *, read_timeout: float | None = None
    ) -> str:
        read_s = float(read_timeout if read_timeout is not None else self.timeout)
        url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
        prompt_chars = sum(len(str(m.get("content") or "")) for m in messages)
        payload = {
            "model": settings.ollama_chat_model,
            "messages": messages,
            "stream": False,
        }
        logger.info(
            "Ollama POST %s model=%s read_timeout=%.1fs prompt_chars=%d",
            url,
            settings.ollama_chat_model,
            read_s,
            prompt_chars,
        )
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=_client_timeout(read_s)) as client:
                response = await client.post(url, json=payload)
            await _raise_for_ollama_chat(response)
            data = response.json()
            content = data.get("message", {}).get("content")
            if not isinstance(content, str):
                raise ValueError("Ollama 返回格式异常")
            elapsed = time.monotonic() - t0
            logger.info(
                "Ollama 响应 OK: %.2fs 输出_chars=%d",
                elapsed,
                len(content),
            )
            return content
        except httpx.ReadTimeout as e:
            logger.warning(
                "Ollama ReadTimeout（read=%.1fs）：润色/长上下文时常见，可增大 WRITER_LLM_TIMEOUT_SECONDS "
                "或 LLM_REQUEST_TIMEOUT_SECONDS。prompt_chars=%d err=%r",
                read_s,
                prompt_chars,
                e,
            )
            raise
        except httpx.RequestError as e:
            logger.warning(
                "Ollama 网络错误 url=%s read=%.1fs err=%r",
                url,
                read_s,
                e,
            )
            raise

    async def _stream_ollama(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        payload = {
            "model": settings.ollama_chat_model,
            "messages": messages,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", f"{settings.ollama_base_url}/api/chat", json=payload
            ) as response:
                await _raise_for_ollama_stream(response)
                async for raw_line in response.aiter_lines():
                    if not raw_line.strip():
                        continue
                    try:
                        parsed = json.loads(raw_line)
                    except json.JSONDecodeError:
                        continue
                    chunk = parsed.get("message", {}).get("content", "")
                    if chunk:
                        yield json.dumps({"message": {"content": chunk}}, ensure_ascii=False) + "\n"

    async def _openai_chat(
        self, messages: List[Dict[str, str]], *, read_timeout: float | None = None
    ) -> str:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY 未配置")
        read_s = float(read_timeout if read_timeout is not None else self.timeout)
        payload = {
            "model": settings.openai_chat_model,
            "messages": messages,
            "stream": False,
            "temperature": 0.7,
        }
        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        async with httpx.AsyncClient(timeout=_client_timeout(read_s)) as client:
            response = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def _stream_openai(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY 未配置")
        payload = {
            "model": settings.openai_chat_model,
            "messages": messages,
            "stream": True,
            "temperature": 0.7,
        }
        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{settings.openai_base_url}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    delta = parsed.get("choices", [{}])[0].get("delta", {})
                    chunk = delta.get("content", "")
                    if chunk:
                        yield json.dumps({"message": {"content": chunk}}, ensure_ascii=False) + "\n"


model_router = ModelRouter()
