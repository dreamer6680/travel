from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Dict, List

import httpx

from .config import settings


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
        except Exception:
            if self.fallback_provider and self.fallback_provider != self.provider:
                return await self.chat_once(messages, self.fallback_provider)
            raise

    async def stream_chat_with_fallback(
        self, messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        try:
            async for line in self._stream_chat(messages, self.provider):
                yield line
        except Exception:
            if self.fallback_provider and self.fallback_provider != self.provider:
                async for line in self._stream_chat(messages, self.fallback_provider):
                    yield line
            else:
                raise

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
            response.raise_for_status()
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
                response.raise_for_status()
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
