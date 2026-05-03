from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId
from database import get_collection
from auth.schemas import CandidateSignup, LoginRequest, TokenResponse
from auth.utils import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
async def signup(data: CandidateSignup):
    if data.password != data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    candidates = get_collection("candidates")
    existing = await candidates.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    doc = {
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.onboarding.name,
        "profession": data.onboarding.profession,
        "tech_stack": data.onboarding.tech_stack,
        "intro": data.onboarding.intro,
        "experience_level": data.onboarding.experience_level,
        "preferred_domain": data.onboarding.preferred_domain,
        "created_at": datetime.utcnow(),
    }
    result = await candidates.insert_one(doc)
    user_id = str(result.inserted_id)

    token = create_token({"sub": user_id, "role": "candidate"})
    return TokenResponse(
        access_token=token,
        role="candidate",
        user_id=user_id,
        name=data.onboarding.name,
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    admins = get_collection("admins")
    admin = await admins.find_one({"email": data.email})
    if admin and verify_password(data.password, admin["password_hash"]):
        user_id = str(admin["_id"])
        token = create_token({"sub": user_id, "role": "admin"})
        return TokenResponse(
            access_token=token,
            role="admin",
            user_id=user_id,
            name=admin.get("name", "Admin"),
        )

    candidates = get_collection("candidates")
    candidate = await candidates.find_one({"email": data.email})
    if candidate and verify_password(data.password, candidate["password_hash"]):
        user_id = str(candidate["_id"])
        token = create_token({"sub": user_id, "role": "candidate"})
        return TokenResponse(
            access_token=token,
            role="candidate",
            user_id=user_id,
            name=candidate.get("name"),
        )

    raise HTTPException(status_code=401, detail="Invalid email or password")
