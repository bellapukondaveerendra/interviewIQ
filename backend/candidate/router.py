from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import get_collection
from auth.utils import require_candidate

router = APIRouter(prefix="/candidate", tags=["candidate"])

STATUS_LABELS = {
    "pending_stage_1": "Pending Interview",
    "pending_stage_2": "Pending Interview",
    "pending_stage_3": "Pending Interview",
    "pending_approval": "Waiting for Approval",
    "rejected": "Rejected",
    "hired": "Hired",
}


@router.get("/dashboard")
async def get_dashboard(candidate=Depends(require_candidate)):
    invitations_col = get_collection("interview_invitations")
    campaigns_col = get_collection("interview_campaigns")

    invitations_data = []
    async for inv in invitations_col.find({"candidate_id": candidate["id"]}):
        campaign = await campaigns_col.find_one(
            {"_id": ObjectId(inv["campaign_id"])}
        )
        if not campaign:
            continue

        status = inv["status"]
        current_stage_info = None
        for stage in campaign.get("stages", []):
            if stage["stage_number"] == inv.get("current_stage_number"):
                current_stage_info = stage
                break

        invitations_data.append({
            "invitation_id": str(inv["_id"]),
            "status": status,
            "status_label": STATUS_LABELS.get(status, status),
            "campaign": {
                "id": str(campaign["_id"]),
                "job_title": campaign["job_title"],
                "stage_count": len(campaign.get("stages", [])),
            },
            "current_stage_number": inv.get("current_stage_number"),
            "current_stage_info": current_stage_info,
            "can_start_interview": status.startswith("pending_stage_"),
        })

    return {
        "candidate": {
            "id": candidate["id"],
            "name": candidate.get("name"),
            "email": candidate.get("email"),
            "profession": candidate.get("profession"),
            "experience_level": candidate.get("experience_level"),
        },
        "invitations": invitations_data,
    }


@router.get("/invitations/{invitation_id}")
async def get_invitation(
    invitation_id: str, candidate=Depends(require_candidate)
):
    invitations_col = get_collection("interview_invitations")
    inv = await invitations_col.find_one(
        {"_id": ObjectId(invitation_id), "candidate_id": candidate["id"]}
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    campaigns_col = get_collection("interview_campaigns")
    campaign = await campaigns_col.find_one({"_id": ObjectId(inv["campaign_id"])})

    status = inv["status"]
    return {
        "invitation_id": invitation_id,
        "status": status,
        "status_label": STATUS_LABELS.get(status, status),
        "current_stage_number": inv.get("current_stage_number"),
        "campaign": {
            "id": str(campaign["_id"]),
            "job_title": campaign["job_title"],
            "job_description": campaign.get("job_description", ""),
            "stages": campaign.get("stages", []),
        },
        "can_start_interview": status.startswith("pending_stage_"),
    }


@router.get("/invitations/{invitation_id}/detail")
async def get_invitation_detail(
    invitation_id: str, candidate=Depends(require_candidate)
):
    invitations_col = get_collection("interview_invitations")
    inv = await invitations_col.find_one(
        {"_id": ObjectId(invitation_id), "candidate_id": candidate["id"]}
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    campaigns_col = get_collection("interview_campaigns")
    campaign = await campaigns_col.find_one({"_id": ObjectId(inv["campaign_id"])})

    sessions_col = get_collection("interview_sessions")

    status = inv["status"]
    current_stage_number = inv.get("current_stage_number")
    is_rejected = status == "rejected"

    # Build stage_responses lookup by stage_number
    sr_by_stage = {
        r["stage_number"]: r
        for r in inv.get("stage_responses", [])
    }

    # Build session data lookup by stage_number
    sessions_by_stage = {}
    async for s in sessions_col.find(
        {
            "invitation_id": invitation_id,
            "candidate_id": candidate["id"],
            "status": {"$in": ["completed", "timed_out"]},
        }
    ).sort("stage_number", 1):
        sessions_by_stage[s["stage_number"]] = s

    stages_sorted = sorted(campaign.get("stages", []), key=lambda s: s["order"])

    stages_detail = []
    for stage in stages_sorted:
        sn = stage["stage_number"]
        sr = sr_by_stage.get(sn)
        session = sessions_by_stage.get(sn)

        # Determine stage state
        if status in ("rejected", "hired"):
            stage_state = "completed" if sn <= current_stage_number else "future"
        elif status == "pending_approval":
            if sn < current_stage_number:
                stage_state = "completed"
            elif sn == current_stage_number:
                stage_state = "current"
            else:
                stage_state = "future"
        else:
            # pending_stage_N
            if sn < current_stage_number:
                stage_state = "completed"
            elif sn == current_stage_number:
                stage_state = "pending_interview"
            else:
                stage_state = "future"

        stage_entry = {
            "stage_number": sn,
            "stage_type": stage["stage_type"],
            "order": stage["order"],
            "stage_state": stage_state,
        }

        # Include transcript (qa_pairs without scores) for completed stages
        if session and stage_state in ("completed", "current"):
            stage_entry["qa_pairs"] = [
                {
                    "question_number": qa.get("question_number"),
                    "question": qa.get("question"),
                    "answer": qa.get("answer"),
                    "feedback": qa.get("feedback"),
                    "suggestions": qa.get("suggestions"),
                }
                for qa in session.get("qa_pairs", [])
            ]
            stage_entry["session_status"] = session.get("status")

        # Include admin review only if:
        # - admin has actually reviewed this stage (admin_approved field exists)
        # - candidate was not rejected (hide admin reasoning on rejection)
        if sr and sr.get("admin_approved") is not None and not is_rejected:
            stage_entry["admin_review"] = {
                "approved": sr["admin_approved"],
                "feedback": sr.get("admin_feedback"),
            }

        stages_detail.append(stage_entry)

    return {
        "invitation_id": invitation_id,
        "status": status,
        "status_label": STATUS_LABELS.get(status, status),
        "current_stage_number": current_stage_number,
        "can_start_interview": status.startswith("pending_stage_"),
        "campaign": {
            "id": str(campaign["_id"]),
            "job_title": campaign["job_title"],
            "job_description": campaign.get("job_description", ""),
            "stages": stages_sorted,
        },
        "stages_detail": stages_detail,
    }
