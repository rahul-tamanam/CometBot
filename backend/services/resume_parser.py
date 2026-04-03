import json
import re
import pdfplumber
import tempfile
import os
from backend.services.llm_client import chat


def _repair_json_fragment(s: str) -> str:
    """Common fixes for model-generated JSON."""
    s = re.sub(r",\s*(\]|})", r"\1", s)
    return s


def _extract_json_object(text: str) -> dict | None:
    """Pull the first top-level {...} from model output when json.loads fails."""
    t = (text or "").strip()
    start = t.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(t)):
        if t[i] == "{":
            depth += 1
        elif t[i] == "}":
            depth -= 1
            if depth == 0:
                chunk = _repair_json_fragment(t[start : i + 1])
                try:
                    obj = json.loads(chunk)
                    return obj if isinstance(obj, dict) else None
                except json.JSONDecodeError:
                    return None
    return None


_SKILL_CANON = {
    "sql": "SQL",
    "aws": "AWS",
    "gcp": "GCP",
    "nlp": "NLP",
    "etl": "ETL",
    "elt": "ELT",
    "vba": "VBA",
    "html": "HTML",
    "css": "CSS",
    "php": "PHP",
    "api": "API",
}

# Longest phrases first so multi-word skills match before shorter tokens.
_SKILL_PHRASES: tuple[str, ...] = tuple(
    sorted(
        {
            "machine learning",
            "deep learning",
            "natural language processing",
            "data visualization",
            "data engineering",
            "business analytics",
            "predictive modeling",
            "time series",
            "a/b testing",
            "ab testing",
            "power bi",
            "tableau",
            "looker",
            "qlik",
            "snowflake",
            "azure",
            "kubernetes",
            "docker",
            "jenkins",
            "airflow",
            "databricks",
            "pytorch",
            "tensorflow",
            "scikit-learn",
            "sklearn",
            "keras",
            "pandas",
            "numpy",
            "matplotlib",
            "seaborn",
            "jupyter",
            "excel",
            "postgresql",
            "mysql",
            "mongodb",
            "redis",
            "spark",
            "hadoop",
            "kafka",
            "sql server",
            "oracle",
            "javascript",
            "typescript",
            "node.js",
            "react",
            "angular",
            "vue",
            "django",
            "flask",
            "fastapi",
            "spring boot",
            "git",
            "github",
            "jira",
            "agile",
            "scrum",
            "saas",
            "terraform",
            "graphql",
            "rest api",
            "aws",
            "gcp",
            "etl",
            "elt",
            "nlp",
            "statistics",
            "hypothesis testing",
            "regression",
            "classification",
            "clustering",
            "opencv",
            "linux",
            "unix",
            "bash",
            "shell",
            "c++",
            "c#",
            ".net",
            "sap",
            "salesforce",
            "rstudio",
            "sas",
            "stata",
            "scala",
            "java",
            "swift",
            "kotlin",
            "google cloud",
            "cloudformation",
            "lambda",
            "sql",
            "python",
            "php",
            "rust",
            "ruby",
        },
        key=len,
        reverse=True,
    )
)


def _skills_from_text_heuristic(text: str) -> list[str]:
    """Backup skill list when the LLM returns empty skills (substring + word-boundary singles)."""
    if not text.strip():
        return []
    t = " " + re.sub(r"\s+", " ", text.lower()) + " "
    found: list[str] = []
    seen: set[str] = set()

    def _add(key: str, display: str) -> None:
        lk = key.lower()
        if lk not in seen:
            seen.add(lk)
            found.append(display)

    for phrase in _SKILL_PHRASES:
        p = phrase.strip().lower()
        if not p:
            continue
        if " " in p:
            if p in t:
                disp = " ".join(w.capitalize() for w in phrase.split())
                _add(p, disp)
        else:
            if re.search(r"(?<![a-z0-9])" + re.escape(p) + r"(?![a-z0-9])", t):
                disp = _SKILL_CANON.get(p, p.upper() if len(p) <= 4 and p.isalpha() else phrase.title())
                _add(p, disp)

    # R and Go need word boundaries (not stored as single-char tokens above).
    if re.search(r"(?<![a-z0-9])r(?![a-z0-9])", t) and "r" not in seen:
        _add("r", "R")
    if re.search(r"(?<![a-z0-9])go(?![a-z0-9])", t) and "go" not in seen:
        _add("go", "Go")

    found.sort(key=str.lower)
    return found


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


def llm_resume_to_json(text: str) -> dict:
    """
    Convert raw resume text into a structured JSON profile using the LLM.
    Heuristic fallback in parse_resume() fills skills if this returns empty.
    """
    system_prompt = """
You extract structured data from resume text. Reply with ONE JSON object only.
The first character MUST be { and the last MUST be }. No markdown, no code fences, no commentary.

Exact shape:
{
  "name": "string or null",
  "skills": ["skill1", "skill2"],
  "experience": [{"title": null, "company": null, "duration": null, "responsibilities": []}],
  "education": ["..."],
  "certifications": ["..."]
}

Rules:
- "skills" MUST list every technical tool, language, framework, and relevant method you see (Python, SQL, Tableau, AWS, Excel, etc.). Minimum: pull from Skills/Technical/Projects sections and bullet verbs.
- Use double quotes for all JSON strings. No trailing commas.
    """.strip()

    truncated = text[:12000]
    user_block = f"Resume text:\n{truncated}\n\nOutput JSON only."
    result = chat(
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": user_block}],
        temperature=0.1,
        validate=False,
    )

    raw = (result.get("text") or "").strip()
    raw = re.sub(r"```json\s*|```", "", raw).strip()
    parsed = None
    repaired = _repair_json_fragment(raw)
    try:
        parsed = json.loads(repaired)
        if not isinstance(parsed, dict):
            parsed = None
    except json.JSONDecodeError:
        parsed = _extract_json_object(raw)
    if isinstance(parsed, dict):
        return parsed
    return {
        "name": None,
        "skills": [],
        "experience": [],
        "education": [],
        "certifications": [],
    }


def parse_resume(file_bytes: bytes) -> dict:
    """
    PDF text extraction + LLM structured JSON. Returns a unified profile dict
    or {"error": str, "skills": []} on failure.
    """
    try:
        text = extract_text_from_pdf(file_bytes)
    except Exception as e:
        return {
            "error": f"Could not read PDF (is it a valid PDF file?): {e}",
            "skills": [],
        }

    if not text:
        return {
            "error": "Could not extract text from this PDF (it may be image-only or encrypted).",
            "skills": [],
        }

    profile = llm_resume_to_json(text)

    # Normalize for downstream code expectations
    skills = profile.get("skills") if isinstance(profile.get("skills"), list) else []
    skills = list(dict.fromkeys(str(s).strip() for s in skills if str(s).strip()))

    heur_skills = _skills_from_text_heuristic(text)
    llm_skills_nonempty = bool(skills)
    if heur_skills:
        skills = list(dict.fromkeys([*skills, *heur_skills]))

    exp = profile.get("experience") if isinstance(profile.get("experience"), list) else []
    job_titles = []
    for e in exp:
        if isinstance(e, dict):
            t = (e.get("title") or "").strip()
            if t:
                job_titles.append(t)
    job_titles = list(dict.fromkeys(job_titles))  # preserve order, dedupe

    education = profile.get("education") if isinstance(profile.get("education"), list) else []
    education = list({str(e).strip() for e in education if str(e).strip()})

    certs = profile.get("certifications") if isinstance(profile.get("certifications"), list) else []
    certs = list({str(c).strip() for c in certs if str(c).strip()})

    parse_warning = None
    if not skills and text:
        parse_warning = (
            "Warning: No skills could be extracted from this resume (PDF text may be weak or the parser "
            "model failed). Try another PDF, a text-based resume, or check LM Studio / LLM_MODEL."
        )
    elif not llm_skills_nonempty and heur_skills:
        parse_warning = "Skills inferred from resume keywords (LLM returned no structured skills list)."

    return {
        "raw_text": text,
        "name": profile.get("name"),
        "skills": skills,
        "job_titles": job_titles,
        "education": education,
        "certifications": certs,
        "experience": exp,
        "parse_warning": parse_warning,
    }