"""
jd_parser.py — extract required skills from a pasted job description.

Primary: LLM extracts structured technical + soft skill lists.
Fallback: heuristic phrase-matching (same vocab as resume_parser)
          used when LLM returns empty lists.
"""

import json
import re

from backend.services.llm_client import chat
from backend.services.resume_parser import extract_skills_from_text
from backend.services.skill_normalizer import normalize_skill_list


def extract_skills_from_jd(job_description: str) -> dict:
    """
    Returns:
    {
        job_title: str,
        technical_skills: list[str],   # normalized canonical names
        soft_skills: list[str],
        experience_years: int | None,
        education: str | None,
    }
    """
    system_prompt = (
        "You are a job description analyzer. Extract the required skills. "
        "Reply with ONE JSON object only. No markdown, no code fences. "
        "Shape: { \"job_title\": str, \"technical_skills\": [], \"soft_skills\": [], "
        "\"experience_years\": null, \"education\": null }. "
        "technical_skills: programming languages, tools, frameworks, methodologies. "
        "soft_skills: interpersonal and leadership skills. "
        "Keep each item concise (1-4 words)."
    )

    try:
        result = chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": f"Extract skills:\n\n{job_description[:3000]}"}],
            temperature=0.1,
            validate=False,
        )
        raw = re.sub(r"```json|```", "", result.get("text", "")).strip()
        parsed = json.loads(raw)
    except Exception:
        parsed = {}

    tech = parsed.get("technical_skills") or []
    soft = parsed.get("soft_skills") or []

    # Fallback if LLM returned nothing
    if not tech:
        tech = extract_skills_from_text(job_description)

    return {
        "job_title": (parsed.get("job_title") or "Target Role").strip(),
        "technical_skills": normalize_skill_list(tech),
        "soft_skills": normalize_skill_list(soft),
        "experience_years": parsed.get("experience_years"),
        "education": parsed.get("education"),
    }
