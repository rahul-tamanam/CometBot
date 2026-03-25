import json
import re
from backend.services.llm_client import chat


def extract_skills_from_jd(job_description: str) -> dict:
    """
    Uses LLM to extract required skills from a raw job description
    pasted from any source (LinkedIn, Indeed, company website, etc.)
    Returns structured technical and soft skills.
    """
    system_prompt = """
You are a job description analyzer. Extract the required skills from the
job description provided.

Return ONLY a JSON object with these exact keys:
- job_title: the job title mentioned or inferred (string)
- technical_skills: list of required technical skills and tools
- soft_skills: list of required soft skills and competencies
- experience_years: minimum years of experience required (integer or null)
- education: required education level or degree (string or null)

Do not include any explanation. Return only valid JSON.
    """.strip()

    # Truncate to avoid token limits
    truncated = job_description[:3000]

    result = chat(
        system_prompt=system_prompt,
        messages=[{
            "role":    "user",
            "content": f"Extract skills from this job description:\n\n{truncated}"
        }],
        temperature=0.1,
        validate=False
    )

    raw = result["text"].strip()
    raw = re.sub(r"```json|```", "", raw).strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "job_title":        "Unknown Role",
            "technical_skills": [],
            "soft_skills":      [],
            "experience_years": None,
            "education":        None
        }

    return parsed