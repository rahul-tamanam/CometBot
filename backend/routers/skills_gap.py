from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from backend.services.llm_client import chat
from backend.services.pinecone_client import query_courses_for_skills, query_job_role
from backend.services.validator import validate_course_list
from backend.services.resume_parser import parse_resume
from backend.services.jd_parser import extract_skills_from_jd
from backend.services.course_loader import load_courses_for_program

router = APIRouter()

SYSTEM_PROMPT = """
You are a skills gap analyzer for MSBA students at UT Dallas.

You will be given a pre-computed skills gap analysis including the
student's matched skills, missing skills, and a FIXED list of course
recommendations retrieved from the MSBA course catalog.

Your job is to:
1. Acknowledge what the student already has — be specific and encouraging
2. Clearly explain the most critical missing technical skills to prioritize
3. List missing soft skills briefly
4. At the END subtly suggest the courses from the COURSE RECOMMENDATIONS
   section — use the exact course IDs and titles as provided

CRITICAL RULES:
- You MUST only reference courses that appear in the
  'COURSE RECOMMENDATIONS' section of the analysis
- NEVER invent, guess, or generate course IDs from your own knowledge
- NEVER suggest courses that are not in the provided list
- If no courses are listed for a skill, say no specific course is
  available for that skill rather than inventing one
- Course IDs always follow the pattern: PREFIX + space + 4-digit number
  e.g. BUAN 6341, MIS 6380, OPRE 6302
- Any course ID that does not follow this pattern is invalid

Write plain text only: no Markdown (no # headings, **bold**, *italics*, --- rules, or code fences).
Use short lines and "- " bullets when listing items.
"""

# ── Request models ────────────────────────────────────────────────────────────

class CourseGapRequest(BaseModel):
    completed_courses:    list[str] = []
    target_job:           str       = ""
    job_description:      str       = ""
    conversation_history: list[dict] = []
    message:              str       = "Please perform a skills gap analysis."
    program_id:          str        = "msba"

# ── Gap computation ───────────────────────────────────────────────────────────

def compute_gap(student_skills: list[str], job_role: dict) -> dict:
    student_set   = {s.lower().strip() for s in student_skills}
    tech_required = job_role.get("technical_skills", [])
    soft_required = job_role.get("soft_skills", [])

    matched           = []
    missing_technical = []
    missing_soft      = []

    for skill in tech_required:
        if skill.lower().strip() in student_set:
            matched.append({"skill": skill, "type": "technical"})
        else:
            missing_technical.append(skill)

    for skill in soft_required:
        if skill.lower().strip() in student_set:
            matched.append({"skill": skill, "type": "soft"})
        else:
            missing_soft.append(skill)

    return {
        "matched":           matched,
        "missing_technical": missing_technical,
        "missing_soft":      missing_soft
    }


def build_gap_summary(
    gap:             dict,
    recommendations: dict,
    job_title:       str,
    student_skills:  list[str],
    score:           float = None
) -> str:
    matched_text = "\n".join(
        f"  - {m['skill']} ({m['type']})"
        for m in gap["matched"]
    ) or "  None"

    missing_tech_text = "\n".join(
        f"  - {s}" for s in gap["missing_technical"]
    ) or "  None"

    missing_soft_text = "\n".join(
        f"  - {s}" for s in gap["missing_soft"]
    ) or "  None"

    # Build course recommendations with FULL details
    rec_lines = []
    for skill, courses in recommendations.items():
        if courses:
            course_list = " | ".join(
                f"{c['course_id']} — {c['title']}"
                for c in courses
            )
            rec_lines.append(f"  - For '{skill}': {course_list}")

    rec_text = "\n".join(rec_lines) if rec_lines else "  None available"

    score_text = f" (match confidence: {score})" if score else ""

    return f"""
SKILLS GAP ANALYSIS
===================
Target Role: {job_title}{score_text}

STUDENT SKILLS ({len(student_skills)}):
  {', '.join(student_skills) if student_skills else 'None identified'}

MATCHED SKILLS ({len(gap['matched'])}):
{matched_text}

MISSING TECHNICAL SKILLS ({len(gap['missing_technical'])}):
{missing_tech_text}

MISSING SOFT SKILLS ({len(gap['missing_soft'])}):
{missing_soft_text}

COURSE RECOMMENDATIONS — USE ONLY THESE, NO OTHERS:
{rec_text}

IMPORTANT: The course list above is the COMPLETE and ONLY list of
available courses. Do not suggest, invent, or reference any course
that is not explicitly listed above with its course ID and title.
    """.strip()

# ── Endpoint 1: Courses + job role or job description ────────────────────────

@router.post("/analyze")
def analyze_from_courses(request: CourseGapRequest):
    # Step 1 — validate courses and extract student skills
    validation    = validate_course_list(request.completed_courses)
    valid_courses = validation["valid"]

    all_courses = load_courses_for_program(request.program_id or "msba")

    course_map     = {c["course_id"]: c for c in all_courses}
    student_skills = []
    for course in valid_courses:
        skills = course_map.get(
            course["course_id"], {}
        ).get("skills_taught") or []
        student_skills.extend(skills)
    student_skills = list(set(student_skills))

    # Step 2 — get job requirements
    # Priority: job description > job role name
    confidence_warning = None

    if request.job_description.strip():
        # Extract skills from raw JD using LLM
        jd_data  = extract_skills_from_jd(request.job_description)
        job_role = {
            "job_title":        jd_data.get("job_title", "Target Role"),
            "technical_skills": jd_data.get("technical_skills", []),
            "soft_skills":      jd_data.get("soft_skills", [])
        }

    elif request.target_job.strip():
        # Match against Pinecone skills index
        job_role = query_job_role(request.target_job)
        if not job_role:
            return {
                "error": f"No matching role found for: {request.target_job}"
            }
        if job_role["score"] < 0.75:
            confidence_warning = (
                f"Your target role '{request.target_job}' was matched to "
                f"'{job_role['job_title']}' with low confidence "
                f"({job_role['score']}). Consider pasting a job description "
                f"instead for more accurate results."
            )
    else:
        return {"error": "Please provide either a target job title or a job description."}

    # Step 3 — compute gap
    gap             = compute_gap(student_skills, job_role)
    recommendations = query_courses_for_skills(
        gap["missing_technical"],
        n_per_skill=2,
        program_id=request.program_id or "msba"
    )

    # Step 4 — build summary and get LLM response
    summary = build_gap_summary(
        gap, recommendations,
        job_role["job_title"],
        student_skills,
        score=job_role.get("score")
    )

    messages = request.conversation_history + [{
        "role":    "user",
        "content": f"{request.message}\n\n{summary}"
    }]

    result = chat(system_prompt=SYSTEM_PROMPT, messages=messages)

    return {
        "response":           result["text"],
        "corrections":        result["corrections"],
        "removed":            result["removed"],
        "job_role":           job_role,
        "confidence_warning": confidence_warning,
        "gap":                gap,
        "recommendations":    recommendations,
        "student_skills":     student_skills,
        "invalid_courses":    validation["invalid"]
    }

# ── Endpoint 2: Resume + job role or job description ─────────────────────────

@router.post("/analyze-resume")
async def analyze_from_resume(
    file:            UploadFile = File(...),
    target_job:      str        = Form(default=""),
    job_description: str        = Form(default="")
):
    # Step 1 — parse resume
    file_bytes    = await file.read()
    resume_data   = parse_resume(file_bytes)

    if "error" in resume_data:
        return {"error": resume_data["error"]}

    student_skills = resume_data["skills"]

    # Step 2 — get job requirements
    confidence_warning = None

    if job_description.strip():
        jd_data  = extract_skills_from_jd(job_description)
        job_role = {
            "job_title":        jd_data.get("job_title", "Target Role"),
            "technical_skills": jd_data.get("technical_skills", []),
            "soft_skills":      jd_data.get("soft_skills", [])
        }

    elif target_job.strip():
        job_role = query_job_role(target_job)
        if not job_role:
            return {"error": f"No matching role found for: {target_job}"}
        if job_role["score"] < 0.75:
            confidence_warning = (
                f"Your target role '{target_job}' was matched to "
                f"'{job_role['job_title']}' with low confidence "
                f"({job_role['score']}). Consider pasting a job description "
                f"for more accurate results."
            )
    else:
        return {
            "error": "Please provide either a target job title or job description."
        }

    # Step 3 — compute gap
    gap             = compute_gap(student_skills, job_role)
    recommendations = query_courses_for_skills(
        gap["missing_technical"], n_per_skill=2
    )

    # Step 4 — build summary and get LLM response
    resume_context = f"""
Student Profile from Resume:
- Skills identified: {', '.join(student_skills) if student_skills else 'None'}
- Past job titles: {', '.join(resume_data.get('job_titles', [])) or 'None'}
- Education: {', '.join(resume_data.get('education', [])) or 'None'}
- Experience: {resume_data.get('experience_years', 'Unknown')} years
    """.strip()

    summary = build_gap_summary(
        gap, recommendations,
        job_role["job_title"],
        student_skills,
        score=job_role.get("score")
    )

    full_context = f"{resume_context}\n\n{summary}"

    result = chat(
        system_prompt=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": full_context}]
    )

    return {
        "response":           result["text"],
        "corrections":        result["corrections"],
        "removed":            result["removed"],
        "job_role":           job_role,
        "confidence_warning": confidence_warning,
        "gap":                gap,
        "recommendations":    recommendations,
        "student_skills":     student_skills,
        "resume_data":        resume_data,
        # Optional: LLM JSON parse failed but heuristic skills were used — not prepended to chat text.
        "resume_parse_note":  resume_data.get("parse_warning"),
    }