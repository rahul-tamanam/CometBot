"""
Resume parser.

Responsibility: extract clean raw text from PDF or DOCX bytes.
Nothing else. Skill extraction is handled upstream by the Groq judge.

Supports:
- PDF via pdfplumber
- DOCX via mammoth (strips formatting cleanly)
- Unknown MIME: tries PDF then DOCX

No disk writes. All processing from bytes in memory.
"""

import io
import os
import re
import tempfile

_JD_SKILL_PATTERNS: dict[str, tuple[str, ...]] = {
    "Python": ("python", "python3"),
    "SQL": ("sql", "mysql", "postgresql", "sql server"),
    "R": (" r ", "r programming"),
    "Excel": ("excel", "pivot table", "vlookup"),
    "Tableau": ("tableau",),
    "Power BI": ("power bi", "powerbi"),
    "Machine Learning": ("machine learning", "ml "),
    "Deep Learning": ("deep learning",),
    "NLP": ("natural language processing", " nlp "),
    "TensorFlow": ("tensorflow",),
    "PyTorch": ("pytorch",),
    "scikit-learn": ("scikit-learn", "sklearn"),
    "Pandas": ("pandas",),
    "NumPy": ("numpy",),
    "Spark": ("spark", "pyspark"),
    "Hadoop": ("hadoop",),
    "AWS": ("aws", "amazon web services"),
    "Azure": ("azure",),
    "GCP": ("gcp", "google cloud"),
    "Docker": ("docker",),
    "Kubernetes": ("kubernetes", "k8s"),
    "Airflow": ("airflow",),
    "ETL": ("etl", "elt", "data pipeline"),
    "Data Modeling": ("data modeling", "dimensional modeling"),
    "Statistics": ("statistics", "statistical analysis"),
    "A/B Testing": ("a/b testing", "ab testing"),
    "Project Management": ("project management", "agile", "scrum"),
    "Communication": ("communication", "presentation"),
    "Leadership": ("leadership",),
    "Collaboration": ("collaboration", "teamwork", "cross-functional"),
}


def extract_skills_from_text(text: str) -> list[str]:
    """
    Backward-compatible heuristic skill extractor used by jd_parser fallback.
    """
    if not text:
        return []

    haystack = f" {text.lower()} "
    found: list[str] = []

    for canonical, aliases in _JD_SKILL_PATTERNS.items():
        if any(alias in haystack for alias in aliases):
            found.append(canonical)

    return found


def _clean_text(raw: str) -> str:
    """
    Remove noise, normalize whitespace.
    Preserves section structure (blank lines between sections) since
    the Groq judge benefits from seeing the resume layout.
    """
    text = re.sub(r"(?m)^[\s\-=_\.]{4,}\s*$", "", raw)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"(?m)^\s*\d+\s*$", "", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    lines = [ln.rstrip() for ln in text.splitlines()]
    return "\n".join(lines).strip()


def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    import pdfplumber

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        pages: list[str] = []
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    pages.append(extracted)
        return _clean_text("\n\n".join(pages))
    finally:
        os.unlink(tmp_path)


def parse_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes using mammoth."""
    try:
        import mammoth
    except ImportError as exc:
        raise ImportError("mammoth is required for DOCX parsing: pip install mammoth") from exc

    result = mammoth.extract_raw_text(io.BytesIO(file_bytes))
    return _clean_text(result.value or "")


def parse_resume(file_bytes: bytes, mime_type: str = "application/pdf") -> dict:
    """
    Parse a resume file from bytes.

    Returns:
        {
            "raw_text": str,
            "error": str | None
        }

    Skill extraction is NOT done here.
    That is handled by extract_and_rate_skills() in skills_gap.py.
    """
    if not file_bytes:
        return {"raw_text": "", "error": "Empty file received."}

    mime = (mime_type or "").lower()

    try:
        if "pdf" in mime or mime in ("application/octet-stream", ""):
            raw_text = parse_pdf(file_bytes)
        elif any(x in mime for x in ("docx", "openxmlformats", "msword", "wordprocessingml")):
            raw_text = parse_docx(file_bytes)
        else:
            try:
                raw_text = parse_pdf(file_bytes)
            except Exception:
                try:
                    raw_text = parse_docx(file_bytes)
                except Exception:
                    return {
                        "raw_text": "",
                        "error": (
                            f"Unsupported file type: {mime_type}. "
                            "Please upload a PDF or DOCX file."
                        ),
                    }

        if not raw_text.strip():
            return {
                "raw_text": "",
                "error": (
                    "Could not extract text from this file. "
                    "It may be image-only, password-protected, or corrupt. "
                    "Try copying your resume content into a new PDF."
                ),
            }

        return {"raw_text": raw_text, "error": None}

    except Exception as err:
        return {"raw_text": "", "error": f"Failed to parse resume: {str(err)}"}
