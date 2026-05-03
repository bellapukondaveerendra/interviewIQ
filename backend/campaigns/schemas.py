from pydantic import BaseModel
from typing import List
from enum import Enum


class StageType(str, Enum):
    TR = "TR"
    HR = "HR"
    BR = "BR"


class StageInput(BaseModel):
    stage_number: int
    stage_type: StageType
    order: int
    number_of_questions: int = 5


class CampaignCreate(BaseModel):
    job_title: str
    job_description: str
    stages: List[StageInput]
    candidate_emails: List[str]


class CampaignResponse(BaseModel):
    id: str
    job_title: str
    job_description: str
    stages: List[dict]
    candidate_emails: List[str]
    created_at: str
