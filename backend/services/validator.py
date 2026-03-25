import re
import json
import os
from difflib import get_close_matches

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Load valid course IDs once at startup
def _load_valid_courses() -> dict[str, str]:
    """
    Returns a dict of course_id -> title for all valid courses.
    """
    with open(os.path.join(DATA_DIR, "courses.json")) as f:
        courses = json.load(f)
    return {c["course_id"].strip().upper(): c["title"] for c in courses}

VALID_COURSES = _load_valid_courses()
VALID_IDS     = list(VALID_COURSES.keys())

# Regex to find course ID patterns in text e.g. BUAN 6341, MIS 6380
COURSE_ID_PATTERN = re.compile(r'\b([A-Z]{2,5})\s?(\d{4,5})\b')


def extract_course_ids(text: str) -> list[str]:
    """
    Extracts all course ID mentions from a text string.
    Normalizes spacing e.g. BUAN6341 -> BUAN 6341
    """
    matches = COURSE_ID_PATTERN.findall(text)
    return [f"{prefix} {number}" for prefix, number in matches]


def validate_course_id(course_id: str) -> dict:
    """
    Checks if a course ID is valid.
    If not, finds the closest valid match.
    Returns:
      - valid: bool
      - original: str
      - corrected: str | None
      - title: str | None
    """
    normalized = course_id.strip().upper()

    if normalized in VALID_COURSES:
        return {
            "valid":     True,
            "original":  course_id,
            "corrected": normalized,
            "title":     VALID_COURSES[normalized]
        }

    # Find closest match
    close = get_close_matches(normalized, VALID_IDS, n=1, cutoff=0.7)

    if close:
        return {
            "valid":     False,
            "original":  course_id,
            "corrected": close[0],
            "title":     VALID_COURSES[close[0]]
        }

    return {
        "valid":     False,
        "original":  course_id,
        "corrected": None,
        "title":     None
    }


def validate_and_fix_response(text: str) -> dict:
    """
    Main validation function.
    Scans LLM response for course ID mentions,
    validates each one, and replaces invalid IDs
    with corrected versions in the response text.

    Returns:
      - text: corrected response text
      - corrections: list of corrections made
      - removed: list of IDs that had no valid match
    """
    found_ids   = extract_course_ids(text)
    corrections = []
    removed     = []
    fixed_text  = text

    for course_id in set(found_ids):
        result = validate_course_id(course_id)

        if result["valid"]:
            # Already correct — normalize spacing just in case
            normalized = result["corrected"]
            if course_id != normalized:
                fixed_text = fixed_text.replace(course_id, normalized)
            continue

        if result["corrected"]:
            # Replace with corrected ID and title
            corrected = result["corrected"]
            title     = result["title"]
            fixed_text = fixed_text.replace(
                course_id,
                f"{corrected} ({title})"
            )
            corrections.append({
                "original":  course_id,
                "corrected": corrected,
                "title":     title
            })
        else:
            # No valid match found — flag it
            fixed_text = fixed_text.replace(
                course_id,
                f"[INVALID COURSE ID: {course_id}]"
            )
            removed.append(course_id)

    return {
        "text":        fixed_text,
        "corrections": corrections,
        "removed":     removed
    }


def validate_course_list(course_ids: list[str]) -> dict:
    """
    Validates a list of course IDs (e.g. from student input).
    Returns valid courses and flags invalid ones.
    """
    valid   = []
    invalid = []

    for course_id in course_ids:
        result = validate_course_id(course_id)
        if result["valid"]:
            valid.append({
                "course_id": result["corrected"],
                "title":     result["title"]
            })
        else:
            invalid.append(result)

    return {"valid": valid, "invalid": invalid}