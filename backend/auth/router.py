import os
import uuid
import shutil
from fastapi import APIRouter, HTTPException, Form, File, UploadFile
from typing import List
from datetime import datetime
from bson import ObjectId
from database import get_collection
from auth.schemas import LoginRequest, TokenResponse
from auth.utils import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "resumes")


@router.get("/check-email")
async def check_email(email: str):
    candidates = get_collection("candidates")
    existing = await candidates.find_one({"email": email})
    return {"available": existing is None}


@router.post("/signup", response_model=TokenResponse)
async def signup(
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    name: str = Form(...),
    profession: str = Form(...),
    tech_stack: List[str] = Form(...),
    intro: str = Form(...),
    experience_level: str = Form(...),
    preferred_domain: str = Form(...),
    address: str = Form(...),
    city: str = Form(...),
    zipcode: str = Form(...),
    phone: str = Form(...),
    resume: UploadFile = File(...),
):
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    filename = resume.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx"):
        raise HTTPException(status_code=400, detail="Resume must be a PDF or DOCX file")

    candidates = get_collection("candidates")
    existing = await candidates.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4()}.{ext}"
    save_path = os.path.abspath(os.path.join(UPLOAD_DIR, unique_name))
    with open(save_path, "wb") as f:
        shutil.copyfileobj(resume.file, f)

    doc = {
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "profession": profession,
        "tech_stack": tech_stack,
        "intro": intro,
        "experience_level": experience_level,
        "preferred_domain": preferred_domain,
        "address": address,
        "city": city,
        "zipcode": zipcode,
        "phone": phone,
        "resume_path": save_path,
        "resume_filename": filename,
        "created_at": datetime.utcnow(),
    }
    result = await candidates.insert_one(doc)
    user_id = str(result.inserted_id)

    token = create_token({"sub": user_id, "role": "candidate"})
    return TokenResponse(
        access_token=token,
        role="candidate",
        user_id=user_id,
        name=name,
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
