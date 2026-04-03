from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.llm_client import chat
from backend.services.pinecone_client import (
    get_embedding,
    sanitize,
    query_courses_by_embedding,
    query_job_role_by_embedding,
)

router = APIRouter()

SYSTEM_PROMPT = """
You are a career mentor for MSBA students at UT Dallas.

Your ONLY purpose is to provide qualitative career guidance including:
- Explaining what specific job roles involve day to day
- Describing the technical skills required for a role and why they matter
- Describing the soft skills required for a role and why they matter
- Advising on career trajectories and how roles progress over time
- Comparing similar roles (e.g. Data Analyst vs Data Scientist)
- Explaining industry trends and what employers look for

You will be given the closest matching job role with its required skills
and relevant courses from the catalog.

When recommending courses always reference specific course IDs and titles
from the provided data only. Never invent course IDs.

STRICT BOUNDARIES — you do NOT:
- Help with degree planning or credit requirements
- Perform skills gap analysis
- Give specific GPA or admissions advice

If asked about these topics redirect the student:
"For degree planning please use the Degree Planner component.
For a detailed skills gap analysis please use the Skills Gap Analyzer."

Be encouraging, honest, and conversational.

Write plain text only: no Markdown (no # headings, **bold**, *italics*, --- rules, or code fences).
Use short lines and "- " bullets when listing items.
"""

class ChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []

@router.post("/chat")
def career_mentor_chat(request: ChatRequest):
    # Step 1 — embed query once (avoid duplicate embedding work)
    embedding = get_embedding(sanitize(request.message))

    # Step 2 — retrieve closest job role + relevant courses
    job_role = query_job_role_by_embedding(embedding)
    relevant_courses = query_courses_by_embedding(embedding, top_k=8)

    # Step 3 — build context
    job_context = ""
    if job_role:
        job_context = f"""
CLOSEST MATCHING JOB ROLE:
Title: {job_role['job_title']}
Match confidence: {job_role['score']}
Technical Skills Required: {', '.join(job_role['technical_skills'])}
Soft Skills Required: {', '.join(job_role['soft_skills'])}
        """.strip()

    courses_context = "\n\n".join([
        f"Course ID: {c['course_id']}\n"
        f"Title: {c['title']}\n"
        f"Type: {c['course_type']} | Credits: {c.get('credits', 3)}\n"
        f"Skills Taught: {', '.join(c.get('skills_taught') or []) or 'N/A'}"
        for c in relevant_courses
    ])

    system_prompt_with_context = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{job_context}\n\n"
        f"RELEVANT COURSES:\n\n{courses_context}"
    )

    # Step 4 — conversation
    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    result = chat(
        system_prompt=system_prompt_with_context,
        messages=messages
    )

    return {
        "response":    result["text"],
        "corrections": result["corrections"],
        "removed":     result["removed"],
        "job_role":    job_role
    }