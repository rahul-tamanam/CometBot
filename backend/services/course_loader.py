import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
COURSES_DIR = os.path.join(DATA_DIR, "courses")


def _normalize_course(c: dict) -> dict:
    """Ensure all required fields exist with correct types."""
    if c.get("prerequisites") is None:
        c["prerequisites"] = []
    if c.get("only_one_of_these") is None:
        c["only_one_of_these"] = []
    if c.get("skills_taught") is None:
        c["skills_taught"] = []
    if c.get("programs") is None:
        c["programs"] = []
    if c.get("course_track") is None:
        c["course_track"] = None
    if c.get("course_tracks") is None:
        c["course_tracks"] = []
    return c


def load_courses_for_program(program_id: str) -> list[dict]:
    """
    Returns all courses for a program by merging:
    - backend/data/courses/{program_id}_courses.json
    - backend/data/courses/shared_courses.json (filtered to program)
    Program-specific file takes precedence over shared for same course_id.
    Deduplicates by course_id. Normalizes null fields.
    """
    pid = program_id.strip().lower()
    program_file = os.path.join(COURSES_DIR, f"{pid}_courses.json")
    shared_file = os.path.join(COURSES_DIR, "shared_courses.json")

    courses: dict[str, dict] = {}

    if os.path.exists(program_file):
        with open(program_file, encoding="utf-8") as f:
            for c in json.load(f):
                cid = (c.get("course_id") or "").strip().upper()
                if not cid:
                    continue
                c["course_id"] = cid
                courses[cid] = _normalize_course(c)

    if os.path.exists(shared_file):
        with open(shared_file, encoding="utf-8") as f:
            for c in json.load(f):
                cid = (c.get("course_id") or "").strip().upper()
                if not cid:
                    continue
                programs = [p.lower() for p in (c.get("programs") or [])]
                if pid not in programs:
                    continue
                if cid not in courses:
                    c["course_id"] = cid
                    courses[cid] = _normalize_course(c)

    return list(courses.values())


def load_all_courses() -> list[dict]:
    """
    Returns all unique courses across all program files and shared_courses.json.
    Used by validator.py at startup for ID validation across all programs.
    Deduplicates by course_id. Shared file wins for shared courses.
    """
    all_courses: dict[str, dict] = {}

    for fname in os.listdir(COURSES_DIR):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(COURSES_DIR, fname), encoding="utf-8") as f:
            for c in json.load(f):
                cid = (c.get("course_id") or "").strip().upper()
                if not cid:
                    continue
                c["course_id"] = cid
                if cid not in all_courses or fname == "shared_courses.json":
                    all_courses[cid] = _normalize_course(c)

    return list(all_courses.values())
