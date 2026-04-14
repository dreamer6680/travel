from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator, Dict, List

import httpx

from .config import settings

logger = logging.getLogger(__name__)


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

    async def chat_once(self, messages: List[Dict[str, str]], provider: str | None = None) -> str:
        active_provider = provider or self.provider
        if active_provider == "openai":
            return await self._openai_chat(messages)
        return await self._ollama_chat(messages)

    async def chat_with_fallback(self, messages: List[Dict[str, str]]) -> str:
        try:
            return await self.chat_once(messages, self.provider)
        except Exception as primary_exc:
            if not self.fallback_provider or self.fallback_provider == self.provider:
                raise
            try:
                out = await self.chat_once(messages, self.fallback_provider)
            except Exception as fb_exc:
                raise RuntimeError(
                    f"主 LLM ({self.provider}) 失败: {primary_exc}; "
                    f"回退 ({self.fallback_provider}) 失败: {fb_exc}"
                ) from fb_exc
            logger.warning(
                "主 LLM (%s) 失败，已使用回退 (%s)。主因: %s",
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

    async def _ollama_chat(self, messages: List[Dict[str, str]]) -> str:
        payload = {
            "model": settings.ollama_chat_model,
            "messages": messages,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
            await _raise_for_ollama_chat(response)
            data = response.json()
            content = data.get("message", {}).get("content")
            if not isinstance(content, str):
                raise ValueError("Ollama 返回格式异常")
            return content

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

    async def _openai_chat(self, messages: List[Dict[str, str]]) -> str:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY 未配置")
        payload = {
            "model": settings.openai_chat_model,
            "messages": messages,
            "stream": False,
            "temperature": 0.7,
        }
        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
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
