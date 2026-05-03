from pydantic import BaseModel, EmailStr
from typing import Optional


class OnboardingData(BaseModel):
    name: str
    profession: str
    tech_stack: str
    intro: str
    experience_level: str
    preferred_domain: str


class CandidateSignup(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    onboarding: OnboardingData


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    name: Optional[str] = None
