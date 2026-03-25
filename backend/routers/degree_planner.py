from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from neo4j.exceptions import ServiceUnavailable, AuthError
from backend.services.llm_client import chat
from backend.services.pinecone_client import query_courses
from backend.services.neo4j_client import (
    get_valid_next_courses,
    get_degree_progress,
    check_prerequisites_met
)
from backend.services.validator import validate_course_list

router = APIRouter()

SYSTEM_PROMPT = """
You are an academic advisor for the MSBA (Master of Science in Business
Analytics and Artificial Intelligence) program at UT Dallas.

Degree rules:
- 36 total credit hours required to graduate
- 18 credit hours must be CORE courses
- 18 credit hours must be ELECTIVE courses
- Each course is 3 credit hours

CRITICAL CONSTRAINT — Only One Of These groups:
- BUAN 6324, BUAN 6356, and BUAN 6383 are in the same group
- A student can ONLY earn credit for ONE of these three courses
- NEVER recommend more than one course from this group
- If a student has already taken one of these, do not recommend the others

When recommending courses to complete a degree:
- Count carefully — core courses needed = (18 - core_completed) / 3
- Count carefully — elective courses needed = (18 - elective_completed) / 3
- NEVER recommend the same course twice
- NEVER rename a course — always use the exact title from the provided data
- NEVER invent course names or descriptions
- A course listed as ELECTIVE must NEVER appear in a core courses list
- A course listed as CORE must NEVER appear in an elective courses list
- Only recommend courses from the ELIGIBLE COURSES list provided below

STRICT BOUNDARIES — you ONLY answer questions about:
- Course selection and recommendations
- Credit requirements and degree progress
- Prerequisites and course sequencing
- Graduation planning and semester scheduling

If a student asks about ANYTHING outside these topics — including career
advice, job roles, skills, salaries, internships, or skills gap analysis —
refuse and redirect them:
"That's a great question but it falls outside my scope as a Degree Planner.
For career advice, please use the Career Mentor component.
For skills gap analysis, please use the Skills Gap Analyzer component."

Never answer out-of-scope questions even partially.
Always use the exact course ID and exact course title from the provided data.
Never invent, rename, or guess course IDs or titles.
"""

class ChatRequest(BaseModel):
    message: str
    completed_courses: list[str] = []
    conversation_history: list[dict] = []

@router.post("/chat")
def degree_planner_chat(request: ChatRequest):
    # Step 1 — validate student's completed courses
    validation = validate_course_list(request.completed_courses)
    valid_completed = [c["course_id"] for c in validation["valid"]]

    # Step 2/3 — get progress + eligible courses from Neo4j
    try:
        progress = get_degree_progress(valid_completed)
        eligible_courses = get_valid_next_courses(valid_completed)
    except ServiceUnavailable:
        raise HTTPException(
            status_code=503,
            detail=(
                "Neo4j is unavailable. Check NEO4J_URI in your .env and "
                "confirm the database host is reachable."
            ),
        )
    except AuthError:
        raise HTTPException(
            status_code=503,
            detail="Neo4j authentication failed. Check NEO4J_USERNAME and NEO4J_PASSWORD.",
        )
    if not valid_completed:
        # New student — show all core courses as starting point
        eligible_courses = query_courses("core required courses MSBA", top_k=8)
        eligible_ids     = {c["course_id"] for c in eligible_courses}
    # Step 4 — semantic search for query-relevant courses
    relevant_courses = query_courses(request.message, top_k=8)

    # Step 5 — merge eligible and relevant, keeping only eligible ones
    # Step 5 — build courses to show
    if valid_completed:
        eligible_ids      = {c["course_id"] for c in eligible_courses}
        filtered_relevant = [
            c for c in relevant_courses
            if c["course_id"] in eligible_ids
        ]
        courses_to_show = filtered_relevant if filtered_relevant else eligible_courses[:12]
    else:
        # New student — show ALL courses from Pinecone but label clearly
        courses_to_show = eligible_courses

    # Step 6 — build context for LLM
    progress_context = f"""
STUDENT DEGREE PROGRESS:
- Total credits completed: {progress['total_completed']} / 36
- Core credits completed: {progress['core_completed']} / 18
- Elective credits completed: {progress['elective_completed']} / 18
- Credits remaining: {progress['total_remaining']}
- Core remaining: {progress['core_remaining']}
- Elective remaining: {progress['elective_remaining']}
- Percent complete: {progress['percent_complete']}%
    """.strip()

    courses_context = "\n\n".join([
        f"Course ID: {c['course_id']}\n"
        f"Title: {c['title']}\n"
        f"Type: {c['course_type']} | Credits: {c.get('credits', 3)}\n"
        f"Description: {c.get('description', 'N/A')}\n"
        f"Skills Taught: {', '.join(c.get('skills_taught') or []) or 'N/A'}\n"
        f"Only One Of These Group: {', '.join(c.get('only_one_of_these') or []) or 'N/A'}\n"
        f"Prerequisites Met: Yes"
        for c in courses_to_show
    ])

    system_prompt_with_context = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{progress_context}\n\n"
        f"ELIGIBLE COURSES — ONLY RECOMMEND FROM THIS LIST, NO OTHERS:\n\n"
        f"{courses_context}\n\n"
        f"REMINDER: Never rename courses. Never recommend courses not in this list. "
        f"Never recommend more than one course from the same Only One Of These group."
    )

    # Step 7 — build conversation history
    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    # Step 8 — get LLM response with validation
    result = chat(
        system_prompt=system_prompt_with_context,
        messages=messages
    )

    return {
        "response":           result["text"],
        "corrections":        result["corrections"],
        "removed":            result["removed"],
        "progress":           progress,
        "invalid_courses":    validation["invalid"],
        "eligible_count":     len(eligible_courses)
    }