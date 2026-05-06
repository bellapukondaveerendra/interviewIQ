from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from bson import ObjectId
from database import get_collection
from interviews.schemas import (
    StartInterviewRequest, StartInterviewResponse,
    NextQuestionRequest, NextQuestionResponse,
    CompleteRequest, CompleteInterviewResponse,
    TTSRequest, TTSResponse,
)
from interviews.llm import generate_welcome, generate_question, evaluate_all
from interviews.polly import text_to_speech_base64
from auth.utils import require_candidate

router = APIRouter(prefix="/interviews", tags=["interviews"])


async def _load_campaign_and_stage(campaign_id: str, stage_number: int):
    campaigns_col = get_collection("interview_campaigns")
    campaign = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for stage in campaign["stages"]:
        if stage["stage_number"] == stage_number:
            return campaign, stage
    raise HTTPException(status_code=400, detail="Stage not found in campaign")


@router.post("/sessions", response_model=StartInterviewResponse)
async def start_interview(
    data: StartInterviewRequest, candidate=Depends(require_candidate)
):
    invitations_col = get_collection("interview_invitations")
    invitation = await invitations_col.find_one(
        {"_id": ObjectId(data.invitation_id), "candidate_id": candidate["id"]}
    )
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if not invitation["status"].startswith("pending_stage_"):
        raise HTTPException(
            status_code=400,
            detail=f"Interview not available. Current status: {invitation['status']}",
        )

    current_stage_number = invitation["current_stage_number"]
    sessions_col = get_collection("interview_sessions")

    already_done = await sessions_col.find_one(
        {
            "invitation_id": data.invitation_id,
            "stage_number": current_stage_number,
            "status": {"$in": ["completed", "timed_out"]},
        }
    )
    if already_done:
        raise HTTPException(status_code=400, detail="You have already completed this stage interview.")

    # Delete any stale active sessions (refresh = restart, no penalty)
    await sessions_col.delete_many(
        {
            "invitation_id": data.invitation_id,
            "stage_number": current_stage_number,
            "status": "active",
        }
    )

    campaign, stage = await _load_campaign_and_stage(
        invitation["campaign_id"], current_stage_number
    )
    total_questions = stage["number_of_questions"]
    stage_type = stage["stage_type"]
    candidate_name = candidate.get("name", "")

    # Generate welcome + first question
    welcome_text = generate_welcome(stage_type, candidate_name)
    first_question = generate_question(
        job_description=campaign["job_description"],
        stage_type=stage_type,
        qa_pairs=[],
        question_number=1,
        total_questions=total_questions,
    )

    # Combined audio: welcome + pause + first question
    combined_text = f"{welcome_text} {first_question}"
    audio_b64 = text_to_speech_base64(combined_text)

    session_doc = {
        "invitation_id": data.invitation_id,
        "candidate_id": candidate["id"],
        "campaign_id": invitation["campaign_id"],
        "stage_number": current_stage_number,
        "stage_type": stage_type,
        "status": "active",
        "qa_pairs": [],
        "current_question": first_question,
        "overall_score": None,
        "total_questions": total_questions,
        "started_at": datetime.utcnow(),
        "completed_at": None,
    }
    result = await sessions_col.insert_one(session_doc)
    session_id = str(result.inserted_id)

    return StartInterviewResponse(
        session_id=session_id,
        welcome_text=welcome_text,
        first_question=first_question,
        audio_base64=audio_b64,
        total_questions=total_questions,
        stage_type=stage_type,
        job_title=campaign["job_title"],
        job_description=campaign["job_description"],
        candidate_name=candidate_name,
    )


@router.post("/sessions/{session_id}/next", response_model=NextQuestionResponse)
async def next_question(
    session_id: str,
    data: NextQuestionRequest,
    candidate=Depends(require_candidate),
):
    """
    Accept the candidate's answer to the current question.
    If more questions remain: generate next question + TTS, return it.
    If all questions answered: signal completion (no evaluation yet).
    """
    sessions_col = get_collection("interview_sessions")
    session = await sessions_col.find_one(
        {"_id": ObjectId(session_id), "candidate_id": candidate["id"]}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    qa_pairs = session["qa_pairs"]
    total_questions = session["total_questions"]
    current_question = session.get("current_question", "")
    answered_count = len(qa_pairs)

    if answered_count >= total_questions:
        raise HTTPException(status_code=400, detail="All questions already answered. Please submit the interview.")

    # Store this answer (no evaluation yet)
    qa_entry = {
        "question_number": answered_count + 1,
        "question": current_question,
        "answer": data.answer.strip(),
    }
    updated_qa = qa_pairs + [qa_entry]
    is_complete = len(updated_qa) >= total_questions

    if is_complete:
        await sessions_col.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"qa_pairs": updated_qa, "current_question": None}},
        )
        return NextQuestionResponse(is_complete=True)

    # Generate next question
    campaign, stage = await _load_campaign_and_stage(
        session["campaign_id"], session["stage_number"]
    )
    next_q_number = answered_count + 2
    next_question_text = generate_question(
        job_description=campaign["job_description"],
        stage_type=session["stage_type"],
        qa_pairs=updated_qa,
        question_number=next_q_number,
        total_questions=total_questions,
    )
    audio_b64 = text_to_speech_base64(next_question_text)

    await sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"qa_pairs": updated_qa, "current_question": next_question_text}},
    )

    return NextQuestionResponse(
        is_complete=False,
        next_question=next_question_text,
        audio_base64=audio_b64,
        question_number=next_q_number,
        total_questions=total_questions,
    )


@router.post("/sessions/{session_id}/complete", response_model=CompleteInterviewResponse)
async def complete_interview(
    session_id: str,
    body: CompleteRequest,
    candidate=Depends(require_candidate),
):
    """
    End the interview: batch evaluate all Q&A pairs with Claude,
    store scores, compute overall_score, update invitation status.
    """
    sessions_col = get_collection("interview_sessions")
    session = await sessions_col.find_one(
        {"_id": ObjectId(session_id), "candidate_id": candidate["id"]}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session already completed")

    qa_pairs = session["qa_pairs"]

    campaign, stage = await _load_campaign_and_stage(
        session["campaign_id"], session["stage_number"]
    )

    # Batch evaluate all collected Q&A pairs
    evaluated_pairs = qa_pairs.copy()
    if qa_pairs:
        evaluations = evaluate_all(
            job_description=campaign["job_description"],
            stage_type=session["stage_type"],
            qa_pairs=qa_pairs,
        )
        for i, ev in enumerate(evaluations):
            if i < len(evaluated_pairs):
                evaluated_pairs[i].update(ev)

    overall_score = None

    final_status = "timed_out" if body.timed_out else "completed"
    await sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$set": {
                "qa_pairs": evaluated_pairs,
                "status": final_status,
                "overall_score": overall_score,
                "completed_at": datetime.utcnow(),
            }
        },
    )

    invitations_col = get_collection("interview_invitations")
    invitation = await invitations_col.find_one(
        {"_id": ObjectId(session["invitation_id"])}
    )
    current_stage_number = session["stage_number"]

    stage_response_entry = {
        "stage_number": current_stage_number,
        "session_id": session_id,
        "overall_score": overall_score,
        "completed_at": datetime.utcnow(),
    }
    existing_responses = [
        r for r in invitation.get("stage_responses", [])
        if r["stage_number"] != current_stage_number
    ]
    existing_responses.append(stage_response_entry)

    await invitations_col.update_one(
        {"_id": ObjectId(session["invitation_id"])},
        {
            "$set": {
                "status": "pending_approval",
                "stage_responses": existing_responses,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    return CompleteInterviewResponse(
        overall_score=overall_score,
        message="Interview completed. Awaiting admin review.",
    )


@router.post("/tts", response_model=TTSResponse)
async def generate_tts(data: TTSRequest, candidate=Depends(require_candidate)):
    audio_b64 = text_to_speech_base64(data.text)
    return TTSResponse(audio_base64=audio_b64)
