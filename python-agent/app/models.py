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


class ActivityRefModel(BaseModel):
    """PG 向量库主键，供地图与聚合查询。"""

    attractionId: Optional[str] = None
    hotelId: Optional[str] = None
    restaurantId: Optional[str] = None


class ActivityModel(BaseModel):
    time: str
    title: str
    type: str
    description: str
    location: Optional[str] = None
    ref: Optional[ActivityRefModel] = None
    priceYuan: Optional[int] = None


class DayPlanModel(BaseModel):
    day: int
    title: str
    activities: List[ActivityModel] = Field(default_factory=list)


class RecommendationModel(BaseModel):
    name: str
    type: str
    attractionId: Optional[str] = None
    restaurantId: Optional[str] = None


class AlternativeAttractionModel(BaseModel):
    attractionId: str
    name: str
    type: str
    rating: Optional[float] = None
    location: Optional[str] = None
    description: Optional[str] = None


class AlternativeHotelModel(BaseModel):
    hotelId: str
    name: str
    rating: Optional[float] = None
    cost: Optional[int] = None
    location: Optional[str] = None


class AlternativeRestaurantModel(BaseModel):
    restaurantId: str
    name: str
    type: Optional[str] = None
    rating: Optional[float] = None
    priceYuan: Optional[int] = None
    location: Optional[str] = None


class AlternativesModel(BaseModel):
    """备选推荐：用户修改行程时的快速替换候选池。"""

    attractions: List[AlternativeAttractionModel] = Field(default_factory=list)
    hotels: List[AlternativeHotelModel] = Field(default_factory=list)
    restaurants: List[AlternativeRestaurantModel] = Field(default_factory=list)


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
    estimatedCost: Optional[int] = None
    selectedHotel: Optional[Dict[str, Any]] = None
    alternatives: AlternativesModel = Field(default_factory=AlternativesModel)
    createdAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ErrorResponse(BaseModel):
    error: str
