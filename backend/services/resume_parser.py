import spacy
import pdfplumber
import tempfile
import os
from backend.services.llm_client import chat

# Load spaCy model once at startup
nlp = spacy.load("en_core_web_sm")

# Known skill keywords to help spaCy extraction
SKILL_KEYWORDS = {
    "python", "r", "sql", "tableau", "power bi", "excel", "sas",
    "machine learning", "deep learning", "nlp", "statistics",
    "data analysis", "data visualization", "spark", "hadoop",
    "aws", "azure", "gcp", "tensorflow", "pytorch", "scikit-learn",
    "pandas", "numpy", "git", "docker", "kubernetes", "airflow",
    "etl", "data modeling", "data warehousing", "looker", "dbt",
    "java", "scala", "c++", "javascript", "typescript", "react",
    "communication", "leadership", "problem solving", "teamwork",
    "project management", "agile", "scrum", "critical thinking"
}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts raw text from a PDF file given its bytes.
    """
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=".pdf"
    ) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        text = ""
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    finally:
        os.unlink(tmp_path)

    return text.strip()


def spacy_extract(text: str) -> dict:
    """
    Uses spaCy to extract structured data from resume text.
    Returns skills, organizations, and education entities.
    """
    doc = nlp(text)

    # Extract named entities
    organizations = [
        ent.text for ent in doc.ents
        if ent.label_ == "ORG"
    ]
    education = [
        ent.text for ent in doc.ents
        if ent.label_ in ("ORG", "PRODUCT", "WORK_OF_ART")
        and any(word in ent.text.lower() for word in
                ["university", "college", "institute", "school", "bachelor",
                 "master", "phd", "degree", "ms", "mba", "bs", "ba"])
    ]

    # Extract skills by matching against known keyword list
    text_lower = text.lower()
    found_skills = [
        skill for skill in SKILL_KEYWORDS
        if skill in text_lower
    ]

    return {
        "skills":        list(set(found_skills)),
        "organizations": list(set(organizations)),
        "education":     list(set(education))
    }


def llm_extract(text: str, spacy_results: dict) -> dict:
    """
    Uses LLM to extract anything spaCy missed.
    Passes spaCy results as context so LLM only fills gaps.
    """
    system_prompt = """
You are a resume parser. Extract structured information from the resume text.
Return ONLY a JSON object with these exact keys:
- skills: list of technical and soft skills found
- experience_years: estimated years of work experience (integer or null)
- job_titles: list of past job titles
- education: list of degrees or certifications
- tools: list of tools, platforms, or technologies mentioned

Do not include any explanation. Return only valid JSON.
    """.strip()

    already_found = f"""
spaCy already found these skills: {spacy_results['skills']}
Focus on finding skills, tools, and experience that spaCy missed.
    """.strip()

    # Truncate resume to avoid token limits
    truncated = text[:3000]

    result = chat(
        system_prompt=system_prompt,
        messages=[{
            "role":    "user",
            "content": f"{already_found}\n\nResume text:\n{truncated}"
        }],
        temperature=0.1,
        validate=False
    )

    # Parse LLM JSON response
    import json
    import re

    raw = result["text"].strip()

    # Strip markdown code fences if present
    raw = re.sub(r"```json|```", "", raw).strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback if LLM returns malformed JSON
        parsed = {
            "skills":           [],
            "experience_years": None,
            "job_titles":       [],
            "education":        [],
            "tools":            []
        }

    return parsed


def parse_resume(file_bytes: bytes) -> dict:
    """
    Full hybrid resume parser.
    Combines spaCy structural extraction with LLM gap filling.
    Returns a unified profile dict.
    """
    # Step 1 — extract raw text
    text = extract_text_from_pdf(file_bytes)
    if not text:
        return {
            "error":  "Could not extract text from PDF.",
            "skills": []
        }

    # Step 2 — spaCy extraction
    spacy_results = spacy_extract(text)

    # Step 3 — LLM fills gaps
    llm_results = llm_extract(text, spacy_results)

    # Step 4 — merge results
    all_skills = list(set(
        spacy_results["skills"] +
        llm_results.get("skills", []) +
        llm_results.get("tools", [])
    ))

    return {
        "raw_text":        text,
        "skills":          all_skills,
        "job_titles":      llm_results.get("job_titles", []),
        "education":       list(set(
                               spacy_results["education"] +
                               llm_results.get("education", [])
                           )),
        "experience_years": llm_results.get("experience_years"),
        "organizations":   spacy_results["organizations"]
    }