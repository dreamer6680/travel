from dataclasses import dataclass
import os


@dataclass
class Settings:
    app_name: str = "Travel AI Agent Service"
    app_version: str = "1.0.0"
    log_level: str = os.getenv("PY_AGENT_LOG_LEVEL", "INFO")

    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama")
    llm_fallback_provider: str = os.getenv("LLM_FALLBACK_PROVIDER", "openai")

    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")

    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_chat_model: str = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

    request_timeout_seconds: float = float(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "60"))


settings = Settings()
