from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatStreamRequest(BaseModel):
    dialogText: List[ChatMessage] = Field(default_factory=list)


class TripGenerateRequest(BaseModel):
    destination: str
    startDate: str
    endDate: str
    travelers: int = 2
    budget: int = 10000
    travelStyle: str = "balanced"
    interests: str = ""


class ActivityModel(BaseModel):
    time: str
    title: str
    type: str
    description: str
    location: Optional[str] = None


class DayPlanModel(BaseModel):
    day: int
    title: str
    activities: List[ActivityModel] = Field(default_factory=list)


class RecommendationModel(BaseModel):
    name: str
    type: str


class PracticalInfoModel(BaseModel):
    transportation: List[Dict[str, Any]] = Field(default_factory=list)
    accommodation: List[Dict[str, Any]] = Field(default_factory=list)
    tips: List[str] = Field(default_factory=list)


class TripResponseModel(BaseModel):
    id: str
    title: str
    destination: str
    startDate: str
    endDate: str
    travelers: int
    budget: int
    travelStyle: str
    status: str = "confirmed"
    highlights: List[str] = Field(default_factory=list)
    days: List[DayPlanModel] = Field(default_factory=list)
    recommendations: List[RecommendationModel] = Field(default_factory=list)
    practicalInfo: PracticalInfoModel = Field(default_factory=PracticalInfoModel)
    selectedHotel: Optional[Dict[str, Any]] = None
    createdAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ErrorResponse(BaseModel):
    error: str
