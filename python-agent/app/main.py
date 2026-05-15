from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Dict, List

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .agents.graph import trip_agent_graph
from .config import AGENT_DOTENV_APPLIED, AGENT_DOTENV_PATH, AGENT_ROOT, settings
from .model_router import model_router
from .models import (
    ChatMessage,
    ChatStreamRequest,
    ErrorResponse,
    TripGenerateRequest,
    TripResponseModel,
)
from .services.location_tools import enhance_trip_locations
from .services.data_sources import data_sources
from .services.embedding_service import build_preference_text, embed_text
from .services.pg_vector_store import pg_vector_store
from .services.trip_tools import build_candidate_attractions


logging.basicConfig(level=settings.log_level)
logger = logging.getLogger("python-agent")

_amap_ok = bool((settings.amap_web_service_key or "").strip())
logger.info(
    "python-agent 环境: AGENT_ROOT=%s dotenv路径=%s 文件存在=%s load_dotenv返回=%s AMAP_WEB_SERVICE_KEY=%s",
    AGENT_ROOT,
    AGENT_DOTENV_PATH,
    AGENT_DOTENV_PATH.is_file(),
    AGENT_DOTENV_APPLIED,
    "已配置" if _amap_ok else "未配置",
)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="多 Agent 旅行 AI 服务。Node 仅负责接口转发。",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _join_preference_values(value: Any) -> str:
    if isinstance(value, list):
        return "，".join(str(item) for item in value if item)
    if value is None:
        return ""
    return str(value)


def _build_profile_preference_text(destination: str, preferences: Any) -> str:
    normalized_destination = _normalize_recommendation_destination(destination)
    if not isinstance(preferences, dict):
        return build_preference_text(
            destination=normalized_destination,
            travel_style="balanced",
            interests="美食，文化，观景",
            budget=0,
            travelers=0,
        )

    profile_parts = [
        _join_preference_values(preferences.get("interests")),
        _join_preference_values(preferences.get("favoriteDestinations")),
        _join_preference_values(preferences.get("seasons")),
        _join_preference_values(preferences.get("accommodationType")),
        _join_preference_values(preferences.get("transportationPreference")),
    ]
    return build_preference_text(
        destination=normalized_destination,
        travel_style=str(preferences.get("travelStyle") or "balanced"),
        interests="，".join(part for part in profile_parts if part) or "美食，文化，观景",
        budget=int(preferences.get("budget") or 0),
        travelers=0,
    )


def _normalize_recommendation_destination(destination: str) -> str:
    text = (destination or "").strip()
    if text in {"热门城市", "全部", "全部城市", "推荐"}:
        return ""
    return text


async def _resolve_recommendation_query(
    destination: str,
    user_id: str = "",
    preferences: Any = None,
) -> tuple[List[float], str]:
    if user_id:
        stored = await pg_vector_store.get_user_preference_embedding(user_id)
        if stored and stored.get("embedding"):
            logger.info("AI推荐: 使用用户偏好向量 userId=%s destination=%s", user_id, _normalize_recommendation_destination(destination) or "none")
            return stored["embedding"], str(stored.get("preference_text") or "")

    preference_text = _build_profile_preference_text(destination, preferences)
    logger.info("AI推荐: 使用profile偏好文本 destination=%s pref_text=%s", _normalize_recommendation_destination(destination) or "none", preference_text[:120])
    return await embed_text(preference_text), preference_text


@app.get("/healthz")
async def healthz():
    return {
        "ok": True,
        "provider": settings.llm_provider,
        "fallback": settings.llm_fallback_provider,
        "agent_root": str(AGENT_ROOT),
        "dotenv_path": str(AGENT_DOTENV_PATH),
        "dotenv_file_exists": AGENT_DOTENV_PATH.is_file(),
        "dotenv_applied": AGENT_DOTENV_APPLIED,
        "amap_web_service_key_configured": bool((settings.amap_web_service_key or "").strip()),
    }


@app.post(
    "/v1/chat/stream",
    responses={500: {"model": ErrorResponse}},
    summary="流式聊天",
    description="返回与现有前端兼容的 ndjson 行，每行包含 message.content。",
)
async def chat_stream(request: ChatStreamRequest):
    if not request.dialogText:
        raise HTTPException(status_code=400, detail="dialogText is required")

    messages: List[Dict[str, str]] = [
        ChatMessage(role=msg.role, content=msg.content).model_dump() for msg in request.dialogText
    ]

    async def event_stream() -> AsyncGenerator[str, None]:
        async for line in model_router.stream_chat_with_fallback(messages):
            yield line

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.post(
    "/v1/trips/generate",
    response_model=TripResponseModel,
    responses={500: {"model": ErrorResponse}},
    summary="生成行程",
    description="多 Agent 协作：Planner/Retrieval/Route/Budget/Writer。",
)
async def generate_trip(request: TripGenerateRequest):
    try:
        result = await trip_agent_graph.ainvoke({"request": request.model_dump()})
        final_trip = result.get("final_trip")
        if not final_trip:
            raise RuntimeError("trip generation failed")
        return final_trip
    except Exception as exc:
        logger.exception("trip generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post(
    "/v1/trips/locations",
    summary="增强行程地点",
    description="返回包含地点坐标的行程数据，供地图页渲染。"
    "传入 routeSegments 时直接注入路线，跳过高德 API 调用。",
)
async def trip_locations(payload: Dict[str, object]):
    trip = payload.get("trip")
    if not isinstance(trip, dict):
        raise HTTPException(status_code=400, detail="invalid trip payload")
    route_segments = payload.get("routeSegments")
    provided = route_segments if isinstance(route_segments, dict) else None
    return await enhance_trip_locations(trip, provided_segments=provided)


@app.get(
    "/v1/recommendations/ai",
    summary="AI 推荐列表",
    description="兼容原有前端推荐页，返回 AI 推荐结构。",
)
async def ai_recommendations(
    destination: str = Query(default=""),
    userId: str = Query(default=""),
):
    normalized_destination = _normalize_recommendation_destination(destination)
    emb, preference_text = await _resolve_recommendation_query(normalized_destination, userId)
    rows = await data_sources.fetch_recommendations_by_embedding(emb, normalized_destination, preference_text, 20)
    if not rows:
        return build_candidate_attractions(normalized_destination or "热门城市", "美食,文化,观景")
    return rows


@app.post(
    "/v1/recommendations/ai",
    summary="AI 推荐列表（POST）",
    description="与 GET 语义一致，兼容客户端误用 POST。",
)
async def ai_recommendations_post(payload: Dict[str, object]):
    destination = _normalize_recommendation_destination(str(payload.get("destination") or ""))
    user_id = str(payload.get("userId") or "")
    preferences = payload.get("preferences")
    emb, preference_text = await _resolve_recommendation_query(destination, user_id, preferences)
    rows = await data_sources.fetch_recommendations_by_embedding(emb, destination, preference_text, 20)
    if not rows:
        return build_candidate_attractions(destination or "热门城市", "美食,文化,观景")
    return rows


@app.post(
    "/v1/users/preferences/vectorize",
    summary="用户偏好向量化",
    description="兼容 Node 侧用户偏好更新流程，此处保留统一 AI 入口。",
)
async def vectorize_user_preferences(payload: Dict[str, object]):
    user_id = str(payload.get("userId", ""))
    preferences = payload.get("preferences", {})
    pref_text = _build_profile_preference_text("", preferences)
    emb = await embed_text(pref_text)
    try:
        await pg_vector_store.upsert_user_preference_vector(user_id, pref_text, emb)
    except Exception as exc:
        logger.warning("upsert user preference vector failed: %s", exc)
    logger.info("vectorize preferences request user_id=%s", user_id)
    return {
        "ok": True,
        "userId": user_id,
        "embeddingDim": len(emb),
        "preferencesDigest": pref_text[:120],
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(_, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"error": "Internal Server Error"})
