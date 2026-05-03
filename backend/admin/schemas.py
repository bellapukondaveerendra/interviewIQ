from pydantic import BaseModel
from typing import Optional
from enum import Enum


class ReviewAction(str, Enum):
    approve = "approve"
    reject = "reject"


class ReviewRequest(BaseModel):
    action: ReviewAction
    comment: Optional[str] = None
