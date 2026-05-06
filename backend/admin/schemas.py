from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ReviewAction(str, Enum):
    approve = "approve"
    reject = "reject"


class ReviewRequest(BaseModel):
    action: ReviewAction
    comment: Optional[str] = None
    admin_score: int = Field(..., ge=1, le=5)
