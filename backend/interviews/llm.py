import os
import json
import re
import anthropic
from dotenv import load_dotenv

load_dotenv()

_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-haiku-4-5-20251001"

STAGE_LABELS = {
    "TR": "Technical Round",
    "HR": "Human Resources Round",
    "BR": "Business Round",
}


def _format_transcript(qa_pairs: list) -> str:
    """Format completed Q&A pairs as conversation transcript for Claude."""
    if not qa_pairs:
        return "None"
    lines = []
    for qa in qa_pairs:
        lines.append(f"Interviewer: {qa['question']}")
        lines.append(f"Candidate: {qa.get('answer', '[No answer]')}")
    return "\n".join(lines)


def generate_welcome(stage_type: str, candidate_name: str) -> str:
    stage_label = STAGE_LABELS.get(stage_type, stage_type)
    name = candidate_name.strip() if candidate_name else "there"
    return f"Hi {name}, welcome to your {stage_label} interview. Let's get started."


def generate_question(
    job_description: str,
    stage_type: str,
    qa_pairs: list,
    question_number: int,
    total_questions: int,
) -> str:
    stage_label = STAGE_LABELS.get(stage_type, stage_type)
    transcript = _format_transcript(qa_pairs)

    prompt = f"""You are a strict, professional interviewer conducting a {stage_label} interview.

Job Description:
{job_description}

Interview Stage: {stage_label} ({stage_type})

Conversation so far:
{transcript}

You are now asking question {question_number} of {total_questions}.

Rules:
- Ask exactly ONE question in a natural, conversational tone like a real interviewer
- Build naturally on the candidate's previous answers when possible
- Do NOT repeat any previous questions
- For TR: focus on technical depth, system design, problem-solving, coding concepts
- For HR: focus on behavioral examples, communication, past experiences, culture fit
- For BR: focus on business acumen, decision-making, strategy, domain knowledge
- Do NOT include numbering, labels, evaluation, or preamble
- Output ONLY the question text itself — nothing else

Question {question_number}:"""

    response = _client.messages.create(
        model=MODEL,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def evaluate_all(
    job_description: str,
    stage_type: str,
    qa_pairs: list,
) -> list:
    """
    Batch evaluate all Q&A pairs at interview end.
    Returns list of evaluation dicts in the same order as qa_pairs.
    """
    stage_label = STAGE_LABELS.get(stage_type, stage_type)
    results = []

    for qa in qa_pairs:
        question = qa.get("question", "")
        answer = qa.get("answer", "")

        prompt = f"""You are evaluating a candidate's spoken response in a {stage_label} interview.

Job Description:
{job_description}

Question asked:
{question}

Candidate's answer:
{answer.strip() if answer.strip() else "[No answer provided]"}

Evaluate the answer strictly and return ONLY valid JSON in exactly this format — no other text:
{{
  "score": <integer 1-10>,
  "feedback": "<1-2 sentences of direct, specific feedback>",
  "suggestions": "<1-2 sentences of specific, actionable improvement suggestions>"
}}"""

        response = _client.messages.create(
            model=MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()

        json_match = re.search(r'\{.*?\}', raw, re.DOTALL)
        if json_match:
            raw = json_match.group()

        try:
            result = json.loads(raw)
            results.append({
                "score": max(1, min(10, int(result.get("score", 5)))),
                "feedback": str(result.get("feedback", "")),
                "suggestions": str(result.get("suggestions", "")),
            })
        except (json.JSONDecodeError, ValueError, TypeError):
            results.append({
                "score": 5,
                "feedback": "Unable to evaluate this response.",
                "suggestions": "Provide more detailed and structured answers.",
            })

    return results
