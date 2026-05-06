from pydantic import BaseModel
from typing import Optional


class StartInterviewRequest(BaseModel):
    invitation_id: str


class StartInterviewResponse(BaseModel):
    session_id: str
    welcome_text: str
    first_question: str
    audio_base64: str       # combined welcome + first question audio
    total_questions: int
    stage_type: str
    job_title: str
    job_description: str
    candidate_name: str


class NextQuestionRequest(BaseModel):
    answer: str             # the candidate's spoken/typed answer to current question


class NextQuestionResponse(BaseModel):
    is_complete: bool
    next_question: Optional[str] = None
    audio_base64: Optional[str] = None
    question_number: Optional[int] = None
    total_questions: Optional[int] = None


class CompleteRequest(BaseModel):
    timed_out: bool = False


class CompleteInterviewResponse(BaseModel):
    overall_score: Optional[float] = None
    message: str


class TTSRequest(BaseModel):
    text: str


class TTSResponse(BaseModel):
    audio_base64: str
