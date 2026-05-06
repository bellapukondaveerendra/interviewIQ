import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from datetime import datetime
from bson import ObjectId
from database import get_collection
from admin.schemas import ReviewRequest, ReviewAction
from auth.utils import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/campaigns")
async def get_campaigns(admin=Depends(require_admin)):
    campaigns_col = get_collection("interview_campaigns")
    invitations_col = get_collection("interview_invitations")
    result = []
    async for c in campaigns_col.find():
        c_id = str(c["_id"])
        status_counts = {"pending_candidate": 0, "pending_approval": 0, "hired": 0, "rejected": 0}
        async for inv in invitations_col.find({"campaign_id": c_id}, {"status": 1}):
            s = inv["status"]
            if s.startswith("pending_stage_"):
                status_counts["pending_candidate"] += 1
            elif s in status_counts:
                status_counts[s] += 1
        total = sum(status_counts.values())
        result.append({
            "id": c_id,
            "job_title": c["job_title"],
            "job_description": c.get("job_description", ""),
            "stages": c.get("stages", []),
            "candidate_count": total,
            "status_counts": status_counts,
            "created_at": c["created_at"].isoformat(),
        })
    return result


@router.get("/campaigns/{campaign_id}/candidates")
async def get_campaign_candidates(campaign_id: str, admin=Depends(require_admin)):
    campaigns_col = get_collection("interview_campaigns")
    campaign = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    invitations_col = get_collection("interview_invitations")
    candidates_col = get_collection("candidates")
    result = []

    async for inv in invitations_col.find({"campaign_id": campaign_id}):
        candidate = await candidates_col.find_one(
            {"_id": ObjectId(inv["candidate_id"])}
        )
        if not candidate:
            continue
        result.append({
            "invitation_id": str(inv["_id"]),
            "candidate": {
                "id": str(candidate["_id"]),
                "name": candidate.get("name"),
                "email": candidate.get("email"),
                "profession": candidate.get("profession"),
                "experience_level": candidate.get("experience_level"),
                "preferred_domain": candidate.get("preferred_domain"),
            },
            "status": inv["status"],
            "current_stage_number": inv.get("current_stage_number"),
            "updated_at": inv["updated_at"].isoformat() if inv.get("updated_at") else None,
        })
    return result


@router.get("/invitations/{invitation_id}/review")
async def get_candidate_review(invitation_id: str, admin=Depends(require_admin)):
    invitations_col = get_collection("interview_invitations")
    invitation = await invitations_col.find_one({"_id": ObjectId(invitation_id)})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    candidates_col = get_collection("candidates")
    candidate = await candidates_col.find_one(
        {"_id": ObjectId(invitation["candidate_id"])}
    )

    campaigns_col = get_collection("interview_campaigns")
    campaign = await campaigns_col.find_one(
        {"_id": ObjectId(invitation["campaign_id"])}
    )

    sr_by_stage = {
        r["stage_number"]: r
        for r in invitation.get("stage_responses", [])
    }

    sessions_col = get_collection("interview_sessions")
    sessions = []
    async for s in sessions_col.find(
        {
            "invitation_id": invitation_id,
            "status": {"$in": ["completed", "timed_out"]},
        }
    ).sort("stage_number", 1):
        sn = s["stage_number"]
        sr = sr_by_stage.get(sn, {})
        sessions.append({
            "stage_number": sn,
            "stage_type": s["stage_type"],
            "status": s["status"],
            "qa_pairs": s.get("qa_pairs", []),
            "started_at": s["started_at"].isoformat() if s.get("started_at") else None,
            "completed_at": s["completed_at"].isoformat() if s.get("completed_at") else None,
            "admin_approved": sr.get("admin_approved"),
            "admin_feedback": sr.get("admin_feedback"),
            "admin_score": sr.get("admin_score"),
        })

    current_stage_number = invitation.get("current_stage_number")
    inv_status = invitation["status"]
    stages_sorted = sorted(campaign.get("stages", []), key=lambda s: s["order"])

    stage_states = {}
    for stage in stages_sorted:
        sn = stage["stage_number"]
        if inv_status in ("rejected", "hired"):
            stage_states[sn] = "completed" if sn <= current_stage_number else "future"
        elif inv_status == "pending_approval":
            if sn < current_stage_number:
                stage_states[sn] = "completed"
            elif sn == current_stage_number:
                stage_states[sn] = "current"
            else:
                stage_states[sn] = "future"
        else:
            if sn < current_stage_number:
                stage_states[sn] = "completed"
            elif sn == current_stage_number:
                stage_states[sn] = "pending_interview"
            else:
                stage_states[sn] = "future"

    tech_stack = candidate.get("tech_stack", [])
    if isinstance(tech_stack, str):
        tech_stack = [t.strip() for t in tech_stack.split(",") if t.strip()]

    return {
        "invitation_id": invitation_id,
        "candidate": {
            "id": str(candidate["_id"]),
            "name": candidate.get("name"),
            "email": candidate.get("email"),
            "profession": candidate.get("profession"),
            "tech_stack": tech_stack,
            "intro": candidate.get("intro"),
            "experience_level": candidate.get("experience_level"),
            "preferred_domain": candidate.get("preferred_domain"),
            "has_resume": bool(candidate.get("resume_path")),
        },
        "campaign": {
            "id": str(campaign["_id"]),
            "job_title": campaign["job_title"],
            "job_description": campaign.get("job_description"),
            "stages": stages_sorted,
        },
        "invitation": {
            "status": inv_status,
            "current_stage_number": current_stage_number,
            "stage_states": stage_states,
            "stage_responses": invitation.get("stage_responses", []),
        },
        "sessions": sessions,
    }


@router.post("/invitations/{invitation_id}/review")
async def review_candidate(
    invitation_id: str,
    data: ReviewRequest,
    admin=Depends(require_admin),
):
    invitations_col = get_collection("interview_invitations")
    invitation = await invitations_col.find_one({"_id": ObjectId(invitation_id)})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation["status"] != "pending_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot review: status is '{invitation['status']}', expected 'pending_approval'",
        )

    current_stage_number = invitation["current_stage_number"]
    existing_responses = invitation.get("stage_responses", [])

    current_sr = next(
        (r for r in existing_responses if r["stage_number"] == current_stage_number),
        None,
    )
    if not current_sr:
        raise HTTPException(
            status_code=400,
            detail=f"No completed interview found for stage {current_stage_number}. Cannot review.",
        )

    updated_responses = [
        {
            **r,
            "admin_approved": data.action == ReviewAction.approve,
            "admin_feedback": data.comment or None,
            "admin_score": data.admin_score,
            "reviewed_at": datetime.utcnow(),
        }
        if r["stage_number"] == current_stage_number
        else r
        for r in existing_responses
    ]

    if data.action == ReviewAction.reject:
        await invitations_col.update_one(
            {"_id": ObjectId(invitation_id)},
            {
                "$set": {
                    "status": "rejected",
                    "stage_responses": updated_responses,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return {"status": "rejected", "message": "Candidate has been rejected."}

    campaigns_col = get_collection("interview_campaigns")
    campaign = await campaigns_col.find_one(
        {"_id": ObjectId(invitation["campaign_id"])}
    )
    stages_sorted = sorted(campaign["stages"], key=lambda s: s["order"])

    next_stage = None
    for stage in stages_sorted:
        if stage["stage_number"] > current_stage_number:
            next_stage = stage
            break

    if next_stage is None:
        await invitations_col.update_one(
            {"_id": ObjectId(invitation_id)},
            {
                "$set": {
                    "status": "hired",
                    "stage_responses": updated_responses,
                    "updated_at": datetime.utcnow(),
                }
            },
        )
        return {"status": "hired", "message": "Candidate has been hired!"}

    await invitations_col.update_one(
        {"_id": ObjectId(invitation_id)},
        {
            "$set": {
                "status": f"pending_stage_{next_stage['stage_number']}",
                "current_stage_number": next_stage["stage_number"],
                "stage_responses": updated_responses,
                "updated_at": datetime.utcnow(),
            }
        },
    )
    return {
        "status": f"pending_stage_{next_stage['stage_number']}",
        "message": f"Candidate approved. Moving to stage {next_stage['stage_number']} ({next_stage['stage_type']}).",
    }


@router.get("/candidates/{candidate_id}/resume")
async def get_resume(candidate_id: str, admin=Depends(require_admin)):
    candidates_col = get_collection("candidates")
    candidate = await candidates_col.find_one({"_id": ObjectId(candidate_id)})
    if not candidate or not candidate.get("resume_path"):
        raise HTTPException(status_code=404, detail="Resume not found")

    resume_path = candidate["resume_path"]
    if not os.path.exists(resume_path):
        raise HTTPException(status_code=404, detail="Resume file not found on server")

    filename = candidate.get("resume_filename", "resume")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"
    if ext == "pdf":
        media_type = "application/pdf"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return FileResponse(path=resume_path, filename=filename, media_type=media_type)
