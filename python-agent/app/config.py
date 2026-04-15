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
    # 须与 `ollama list` 中名称一致；未 pull 时 /api/chat 会 404（与 embedding 模型无关）
    ollama_chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")
    ollama_embedding_model: str = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_chat_model: str = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

    request_timeout_seconds: float = float(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "60"))
    postgres_url: str = os.getenv(
        "POSTGRES_URL",
        f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres123')}"
        f"@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/"
        f"{os.getenv('POSTGRES_DB', 'travel_vectors')}",
    )
    amap_web_service_key: str = os.getenv("AMAP_WEB_SERVICE_KEY", os.getenv("NEXT_PUBLIC_AMAP_KEY", ""))
    # 为 True 时，行程路线节点会用高德重新解析坐标（覆盖 PG 里可能错误或 BD09 偏差）
    amap_refresh_existing_coords: bool = os.getenv(
        "AMAP_REFRESH_EXISTING_COORDS", ""
    ).lower() in ("1", "true", "yes")


settings = Settings()
