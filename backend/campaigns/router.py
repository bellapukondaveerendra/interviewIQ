from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from database import get_collection
from campaigns.schemas import CampaignCreate
from auth.utils import require_admin

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/")
async def create_campaign(data: CampaignCreate, admin=Depends(require_admin)):
    if not data.stages:
        raise HTTPException(status_code=400, detail="At least one stage is required")
    if len(data.stages) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 stages allowed")
    if not data.candidate_emails:
        raise HTTPException(status_code=400, detail="At least one candidate email required")

    orders = [s.order for s in data.stages]
    if len(set(orders)) != len(orders):
        raise HTTPException(status_code=400, detail="Stage orders must be unique")

    candidates_col = get_collection("candidates")
    missing = []
    candidate_ids = {}
    for email in data.candidate_emails:
        candidate = await candidates_col.find_one({"email": email})
        if not candidate:
            missing.append(email)
        else:
            candidate_ids[email] = str(candidate["_id"])

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"These emails are not registered: {', '.join(missing)}",
        )

    stages_sorted = sorted(data.stages, key=lambda s: s.order)

    campaign_doc = {
        "job_title": data.job_title,
        "job_description": data.job_description,
        "stages": [s.model_dump() for s in stages_sorted],
        "candidate_emails": data.candidate_emails,
        "created_by": admin["id"],
        "created_at": datetime.utcnow(),
    }
    campaigns_col = get_collection("interview_campaigns")
    result = await campaigns_col.insert_one(campaign_doc)
    campaign_id = str(result.inserted_id)

    invitations_col = get_collection("interview_invitations")
    for email in data.candidate_emails:
        existing = await invitations_col.find_one(
            {"campaign_id": campaign_id, "candidate_id": candidate_ids[email]}
        )
        if existing:
            continue
        first_stage = stages_sorted[0]
        invitation = {
            "campaign_id": campaign_id,
            "candidate_id": candidate_ids[email],
            "status": f"pending_stage_{first_stage.stage_number}",
            "current_stage_number": first_stage.stage_number,
            "stage_responses": [],
            "admin_comment": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await invitations_col.insert_one(invitation)

    campaign_doc["id"] = campaign_id
    campaign_doc.pop("_id", None)
    campaign_doc["created_at"] = campaign_doc["created_at"].isoformat()
    return campaign_doc


@router.get("/")
async def get_campaigns(admin=Depends(require_admin)):
    campaigns_col = get_collection("interview_campaigns")
    invitations_col = get_collection("interview_invitations")
    campaigns = []
    async for c in campaigns_col.find():
        c_id = str(c["_id"])
        count = await invitations_col.count_documents({"campaign_id": c_id})
        campaigns.append({
            "id": c_id,
            "job_title": c["job_title"],
            "job_description": c.get("job_description", ""),
            "stages": c.get("stages", []),
            "candidate_count": count,
            "created_at": c["created_at"].isoformat(),
        })
    return campaigns


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, admin=Depends(require_admin)):
    campaigns_col = get_collection("interview_campaigns")
    c = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c["id"] = str(c.pop("_id"))
    c["created_at"] = c["created_at"].isoformat()
    return c
