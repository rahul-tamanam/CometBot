import json
import os
import re
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
from backend.services.validator import (
    validate_course_list,
    extract_course_ids,
    resolve_course_input,
)
from backend.services.program_rules import (
    get_credit_requirements,
    get_only_one_of_these_groups,
)


def _course_ids_from_assistant_messages(conversation_history: list[dict]) -> list[str]:
    """
    Course IDs that already appeared in prior assistant replies (e.g. semester plans).
    Treat these as part of the student's plan so Neo4j eligibility/progress matches the chat.
    """
    collected: list[str] = []
    seen: set[str] = set()
    for m in conversation_history or []:
        if not isinstance(m, dict) or m.get("role") != "assistant":
            continue
        content = m.get("content")
        if not isinstance(content, str) or not content.strip():
            continue
        for raw_id in extract_course_ids(content):
            cid = raw_id.strip().upper().replace("  ", " ")
            if cid not in seen:
                seen.add(cid)
                collected.append(raw_id.strip())
    return collected

router = APIRouter()

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "courses.json")
with open(DATA_PATH) as f:
    _ALL_COURSES = json.load(f)
COURSE_MAP = {c["course_id"].strip().upper(): c for c in _ALL_COURSES}
COURSE_TYPE_BY_ID = {
    cid: (c.get("course_type") or "").strip()
    for cid, c in COURSE_MAP.items()
}
COURSE_CREDITS_BY_ID = {
    cid: float(c.get("credits", 3) or 3)
    for cid, c in COURSE_MAP.items()
}

SYSTEM_PROMPT = """
You are an academic advisor for the MSBA (Master of Science in Business Analytics and Artificial Intelligence) program at UT Dallas.

DEGREE RULES:
- 36 total credit hours required to graduate
- 18 credit hours must come from CORE courses
- 18 credit hours must come from ELECTIVE courses
- Each course is 3 credit hours
- Only ONE course from an 'Only One Of These' group counts toward credit

RESPONSE RULES — follow these without exception:
1. When referring to a course, ALWAYS use the exact course ID and the EXACT title from the COURSE REFERENCE TABLE provided. Never paraphrase, shorten, or reword a course title.
2. When recommending core courses, ONLY pick from the REMAINING CORE COURSES list. Never pick from the elective list for core requirements.
3. When recommending elective courses, ONLY pick from the REMAINING ELECTIVE COURSES list. Never pick from the core list for elective requirements.
4. Never recommend a course the student has already completed.
5. Never recommend more than one course from the same Only One Of These group.
6. If a student asks how many credits they have left, use the exact numbers from the STUDENT DEGREE PROGRESS section.
7. Never invent course IDs, titles, descriptions, or credit counts.

STRICT TOPIC BOUNDARIES:
You ONLY answer questions about course selection, degree progress, prerequisites, and graduation planning.
If a student asks about careers, job roles, salaries, skills, or anything outside academic planning, respond with:
"That falls outside my scope as your Degree Planner. Please use the Career Mentor or Skills Gap Analyzer for that."
""".strip()


def build_course_lists(valid_completed_ids: list[str], all_courses: list[dict]) -> tuple[list[dict], list[dict], dict, list[str]]:
    """
    Returns (remaining_core, remaining_elective_prereqs_met, progress, notes)
    """
    rules = get_credit_requirements("msba")
    total_req = float(rules["total_credits"])
    core_req = float(rules["core_credits"])
    elec_req = float(rules["elective_credits"])

    completed_set = {(_normalize_id(x)) for x in (valid_completed_ids or [])}

    # Core remaining: all core catalog courses not completed.
    remaining_core = []
    for c in all_courses:
        cid = _normalize_id(c.get("course_id", ""))
        if not cid or cid in completed_set:
            continue
        if str(c.get("course_type", "")).lower() == "core":
            remaining_core.append(c)

    # Elective remaining: electives whose prereqs are met (Neo4j eligibility)
    eligible = get_valid_next_courses(list(completed_set))
    eligible_ids = {_normalize_id(c.get("course_id", "")) for c in eligible if c.get("course_id")}
    remaining_elective = []
    for c in all_courses:
        cid = _normalize_id(c.get("course_id", ""))
        if not cid or cid in completed_set:
            continue
        if str(c.get("course_type", "")).lower() != "elective":
            continue
        if cid in eligible_ids:
            remaining_elective.append(c)

    # Progress: compute from catalog types
    core_done = 0.0
    elec_done = 0.0
    for cid in completed_set:
        credits = float(COURSE_CREDITS_BY_ID.get(cid, rules["credits_per_course"]) or rules["credits_per_course"])
        if _course_is_core(cid):
            core_done += credits
        elif _course_is_elective(cid):
            elec_done += credits

    total_done = core_done + elec_done
    core_rem = max(0.0, core_req - core_done)
    elec_rem = max(0.0, elec_req - elec_done)
    total_rem = max(0.0, total_req - total_done)
    pct = 0.0 if total_req <= 0 else round((total_done / total_req) * 100, 1)

    progress = {
        "total_completed": round(total_done, 1),
        "core_completed": round(core_done, 1),
        "elective_completed": round(elec_done, 1),
        "total_remaining": round(total_rem, 1),
        "core_remaining": round(core_rem, 1),
        "elective_remaining": round(elec_rem, 1),
        "percent_complete": pct,
    }

    return remaining_core, remaining_elective, progress, []


def _apply_only_one_of_constraints(
    completed_ids: list[str],
    remaining_core: list[dict],
    remaining_elective: list[dict],
) -> tuple[list[dict], list[dict], list[str]]:
    groups = get_only_one_of_these_groups("msba")
    completed = {_normalize_id(x) for x in completed_ids or []}
    notes: list[str] = []

    core_by_id = {_normalize_id(c.get("course_id", "")): c for c in remaining_core if c.get("course_id")}
    elec_by_id = {_normalize_id(c.get("course_id", "")): c for c in remaining_elective if c.get("course_id")}

    for g in groups:
        g_ids = [_normalize_id(x) for x in g]
        done = [x for x in g_ids if x in completed]
        if done:
            keep = done[0]
            for cid in g_ids:
                if cid != keep:
                    core_by_id.pop(cid, None)
                    elec_by_id.pop(cid, None)
            continue

        # none completed -> keep only first representative among remaining lists (if present)
        present = [cid for cid in g_ids if cid in core_by_id or cid in elec_by_id]
        if present:
            keep = present[0]
            for cid in present[1:]:
                core_by_id.pop(cid, None)
                elec_by_id.pop(cid, None)
            course_options: list[str] = []
            for cid in g_ids:
                course_obj = COURSE_MAP.get(cid)
                title = course_obj.get("title", cid) if course_obj else cid
                course_options.append(f"{cid} {title}")
            notes.append(
                "For this core requirement, you only need to complete ONE of the following courses — "
                "pick whichever best fits your background and goals:\n"
                + "\n".join(f"  • {opt}" for opt in course_options)
            )

    return list(core_by_id.values()), list(elec_by_id.values()), notes

class ChatRequest(BaseModel):
    message: str
    completed_courses: list[str] = []
    conversation_history: list[dict] = []
    student_type: str | None = None  # "new" | "current"
    interests: list[str] = []
    course_history: list[dict] = []  # [{course: str, semester: str}]

class PlanRequest(BaseModel):
    completed_courses: list[str] = []
    courses_per_semester: int = 3
    max_semesters: int = 8
    core_per_semester: int | None = None
    elective_per_semester: int | None = None
    interests: list[str] = []
    course_history: list[dict] = []  # [{course: str, semester: str}] for current students


# ── Semester labels (course_history → next term) ─────────────────────────────

_TERM_ORDER = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}
_TERM_NAME = {0: "Spring", 1: "Summer", 2: "Fall", 3: "Winter"}


def _parse_semester_token(s: str):
    raw = (s or "").strip().lower()
    if not raw:
        return None
    m = re.search(r"\bsemester\s*(\d+)\b", raw) or re.search(r"\bsem\.?\s*(\d+)\b", raw)
    if m:
        return ("idx", int(m.group(1)))
    if re.fullmatch(r"\d+", raw):
        return ("idx", int(raw))
    m = re.search(r"\b(\d+)(?:st|nd|rd|th)\s+semester\b", raw)
    if m:
        return ("idx", int(m.group(1)))
    m = re.search(r"\b(fall|spring|summer|winter)\s+(\d{4})\b", raw)
    if m:
        season, year = m.group(1), int(m.group(2))
        if season in _TERM_ORDER:
            return ("cal", year, _TERM_ORDER[season])
    m = re.search(r"\b(\d{4})\s*(fall|spring|summer|winter)\b", raw)
    if m:
        year, season = int(m.group(1)), m.group(2)
        if season in _TERM_ORDER:
            return ("cal", year, _TERM_ORDER[season])
    return None


def _advance_cal_year_term(year: int, term_idx: int) -> tuple[int, int]:
    name = _TERM_NAME.get(term_idx, "Spring").lower()
    if name == "fall":
        return year + 1, 0
    if name == "spring":
        return year, 1
    if name == "summer":
        return year, 2
    if name == "winter":
        return year, 1
    return year + 1, 0


def _cal_label(y: int, tidx: int) -> str:
    return f"{_TERM_NAME.get(tidx, 'Spring')} {y}"


def _generate_forward_cal_labels(year: int, term_idx: int, n: int) -> list[str]:
    labels: list[str] = []
    y, t = year, term_idx
    for _ in range(max(1, n)):
        y, t = _advance_cal_year_term(y, t)
        labels.append(_cal_label(y, t))
    return labels


def _analyze_course_history(ch: list[dict]) -> dict:
    """
    From [{course, semester}, ...] build display lines and the next planning term.
    """
    rows_out: list[str] = []
    idx_vals: list[int] = []
    cal_vals: list[tuple[int, int]] = []

    if not isinstance(ch, list):
        ch = []

    for item in ch:
        if not isinstance(item, dict):
            continue
        c_raw = item.get("course")
        sem_raw = item.get("semester")
        if not isinstance(c_raw, str) or not isinstance(sem_raw, str):
            continue
        c_raw, sem_raw = c_raw.strip(), sem_raw.strip()
        if not c_raw or not sem_raw:
            continue
        resolved = resolve_course_input(c_raw)
        if resolved.get("corrected") and resolved.get("title"):
            cite = f"{resolved['corrected']} — {resolved['title']}"
        else:
            cite = c_raw

        tok = _parse_semester_token(sem_raw)
        if tok and tok[0] == "idx":
            idx_vals.append(tok[1])
            rows_out.append(f"- {cite} (took in Semester {tok[1]} — {sem_raw})")
        elif tok and tok[0] == "cal":
            y, ti = tok[1], tok[2]
            cal_vals.append((y, ti))
            rows_out.append(f"- {cite} (took in {_cal_label(y, ti)} — {sem_raw})")
        else:
            rows_out.append(f"- {cite} (took in {sem_raw})")

    result: dict = {
        "lines":            rows_out,
        "mode":             "none",
        "next_index":       None,
        "next_label":       None,
        "forward_labels":   [],
    }

    if idx_vals:
        mx = max(idx_vals)
        result["mode"] = "index"
        result["next_index"] = mx + 1
        result["next_label"] = f"Semester {mx + 1}"
        result["forward_labels"] = [f"Semester {mx + 1 + i}" for i in range(8)]
    elif cal_vals:
        latest = max(cal_vals, key=lambda t: (t[0], t[1]))
        y, tidx = latest
        result["mode"] = "calendar"
        result["forward_labels"] = _generate_forward_cal_labels(y, tidx, 8)
        result["next_label"] = result["forward_labels"][0] if result["forward_labels"] else None

    return result


def _headings_for_plan_rows(hist_info: dict, n_rows: int) -> list[str]:
    n = max(0, n_rows)
    if hist_info.get("forward_labels"):
        return hist_info["forward_labels"][:n]
    return [f"Semester {i}" for i in range(1, n + 1)]


def _format_prereqs(prereqs: list) -> str:
    if not prereqs:
        return "None"
    lines = []
    for i, group in enumerate(prereqs, start=1):
        if isinstance(group, list):
            lines.append(f"- Group {i} (take ONE): " + ", ".join(group))
        else:
            lines.append(f"- {group}")
    return "\n".join(lines)


def _parse_course_mix(message: str) -> dict | None:
    """
    Parse requests like:
      - "3 courses. 2 core and 1 elective"
      - "take 2 core + 1 elective"
      - "need 4 electives"
    Returns dict {total:int|None, core:int|None, elective:int|None} or None.
    """
    msg = (message or "").lower()
    total = None
    m_total = re.search(r"\b(\d+)\s*(?:courses|classes)\b", msg)
    if m_total:
        total = int(m_total.group(1))

    core = None
    elective = None
    m_core = (
        re.search(r"\b(\d+)\s+more\s+core(?:\s+courses?|\s+classes?)?\b", msg)
        or re.search(r"\banother\s+(\d+)\s+core(?:\s+courses?)?\b", msg)
        or re.search(r"\b(\d+)\s*core\b", msg)
    )
    m_elec = re.search(r"\b(\d+)\s+more\s+electives?\b", msg) or re.search(
        r"\b(\d+)\s*elective\b", msg
    )
    if m_core:
        core = int(m_core.group(1))
    if m_elec:
        elective = int(m_elec.group(1))

    if total is None and core is None and elective is None:
        return None
    return {"total": total, "core": core, "elective": elective}


def _extract_preferences_from_convo(conversation_history: list[dict], user_message: str) -> dict:
    """
    Extract planner preferences from the entire conversation so the final "plan my degree"
    request uses accumulated context.
    """
    texts: list[str] = []
    for m in conversation_history or []:
        if isinstance(m, dict) and isinstance(m.get("content"), str):
            texts.append(m["content"])
    texts.append(user_message or "")
    blob = "\n".join(texts)

    mix = _parse_course_mix(blob) or {}

    # Heuristic: if user mentions "per semester" but not explicit number, keep default 3.
    cps = mix.get("total") or 3

    # Try to capture any declared completed courses in text: course IDs, or titles (one per line / comma separated).
    completed_ids: set[str] = set()
    for cid in extract_course_ids(blob):
        completed_ids.add(cid.strip().upper())

    # Title-ish mentions: look for "completed/took/taken/finished" sentences and resolve parts.
    completed_markers = ("completed", "took", "taken", "finished", "already took", "already taken")
    for chunk in re.split(r"[\n;]+", blob):
        chunk = chunk.strip()
        if len(chunk) < 6:
            continue
        lower = chunk.lower()
        if not any(m in lower for m in completed_markers):
            continue

        # Split lists on commas and "and"
        for part in re.split(r",|\band\b|&", chunk, flags=re.IGNORECASE):
            part = part.strip()
            if len(part) < 6:
                continue
            r = resolve_course_input(part)
            if r.get("corrected"):
                completed_ids.add(str(r["corrected"]).strip().upper())

    # Focus query: last few user turns (used to rank electives by relevance, optional)
    user_turns = []
    for m in (conversation_history or [])[-6:]:
        if isinstance(m, dict) and m.get("role") == "user" and isinstance(m.get("content"), str):
            user_turns.append(m["content"])
    focus_query = " ".join(user_turns + [user_message]).strip()

    return {
        "courses_per_semester": int(cps),
        "core_per_semester": mix.get("core"),
        "elective_per_semester": mix.get("elective"),
        "completed_from_convo": sorted(completed_ids),
        "focus_query": focus_query,
    }


def _only_one_group(course_id: str) -> tuple[str, ...] | None:
    course = COURSE_MAP.get(course_id.strip().upper())
    if not course:
        return None
    group = course.get("only_one_of_these") or []
    group = [g.strip().upper() for g in group if isinstance(g, str)]
    if len(group) <= 1:
        return None
    return tuple(sorted(group))

def _normalize_id(course_id: str) -> str:
    return (course_id or "").strip().upper()


def _enrich_course_record(c: dict) -> dict:
    """
    Use MSBA catalog as source of truth for Type/title (Neo4j/Pinecone can drift or be incomplete).
    """
    cid = _normalize_id(str(c.get("course_id", "")))
    if not cid or cid not in COURSE_MAP:
        return c
    canon = COURSE_MAP[cid]
    out = dict(c)
    out["course_id"] = canon.get("course_id", cid)
    out["course_type"] = canon.get("course_type", out.get("course_type"))
    out["title"] = canon.get("title", out.get("title"))
    out["credits"] = canon.get("credits", out.get("credits", 3))
    out["description"] = canon.get("description", out.get("description", ""))
    out["skills_taught"] = canon.get("skills_taught", out.get("skills_taught") or [])
    out["only_one_of_these"] = canon.get("only_one_of_these", out.get("only_one_of_these") or [])
    return out


def _detect_requested_course_type(message: str) -> str | None:
    """
    Detect core-only vs elective-only recommendation requests without brittle substring rules.

    Old logic required 'core' in the message AND 'elective' absent — that failed for phrases like
    'core courses, no electives', which then sent a mixed course list to the model.
    """
    m = (message or "").lower()
    if not m.strip():
        return None

    only_core = bool(
        re.search(r"\b(only|just)\s+cores?\b", m)
        or re.search(r"\bcores?\s+only\b", m)
    )
    only_elective = bool(
        re.search(r"\b(only|just)\s+electives?\b", m)
        or re.search(r"\belectives?\s+only\b", m)
    )
    exclude_elective = bool(
        re.search(r"\b(without|avoid|skip)\s+electives?\b", m)
        or re.search(r"\b(don't|do not|dont)\s+want\s+electives?\b", m)
    )
    exclude_core = bool(
        re.search(r"\b(without|avoid|skip)\s+cores?\b", m)
        or re.search(r"\b(don't|do not|dont)\s+want\s+cores?\b", m)
    )

    has_core_word = bool(re.search(r"\bcores?\b", m))
    has_elective_word = bool(re.search(r"\belectives?\b", m))

    core_phrase = bool(
        re.search(r"\bcores?\s+(courses?|classes?|options?|pick|recommendations?)\b", m)
        or re.search(r"\b(core|required)\s+(courses?|classes?|requirements?)\b", m)
        or re.search(r"\brequired\s+cores?\b", m)
    )
    elective_phrase = bool(
        re.search(r"\belectives?\s+(courses?|classes?|options?|pick|recommendations?)\b", m)
        or re.search(r"\boptional\s+electives?\b", m)
    )

    comparing = bool(re.search(r"\b(vs\.?|versus|difference|differences|compare)\b", m))

    if only_elective or exclude_core:
        if only_core or exclude_elective:
            return None
        return "Elective"
    if only_core or exclude_elective:
        return "Core"

    if has_core_word and has_elective_word:
        if comparing:
            return None
        if core_phrase and not elective_phrase:
            return "Core"
        if elective_phrase and not core_phrase:
            return "Elective"
        return None

    if core_phrase or (has_core_word and not has_elective_word):
        return "Core"
    if elective_phrase or (has_elective_word and not has_core_word):
        return "Elective"
    return None


def _course_is_core(course_id: str) -> bool:
    return COURSE_TYPE_BY_ID.get(_normalize_id(course_id), "").lower() == "core"

def _course_is_elective(course_id: str) -> bool:
    return COURSE_TYPE_BY_ID.get(_normalize_id(course_id), "").lower() == "elective"

def _prereqs_met(course_id: str, completed: set[str]) -> bool:
    course = COURSE_MAP.get(_normalize_id(course_id))
    if not course:
        return False
    prereqs = course.get("prerequisites") or []
    if not prereqs:
        return True
    for group in prereqs:
        if isinstance(group, list):
            group_ids = {_normalize_id(x) for x in group}
            if not (group_ids & completed):
                return False
        else:
            if _normalize_id(group) not in completed:
                return False
    return True

def _compute_progress_from_catalog(completed_ids: list[str]) -> dict:
    completed_set = {_normalize_id(x) for x in completed_ids if _normalize_id(x)}
    core_credits = 0.0
    elective_credits = 0.0
    for cid in completed_set:
        credits = COURSE_CREDITS_BY_ID.get(cid, 3.0)
        if _course_is_core(cid):
            core_credits += credits
        elif _course_is_elective(cid):
            elective_credits += credits
    total = core_credits + elective_credits
    return {
        "total_completed": round(total, 1),
        "core_completed": round(core_credits, 1),
        "elective_completed": round(elective_credits, 1),
        "total_remaining": max(0.0, 36.0 - total),
        "core_remaining": max(0.0, 18.0 - core_credits),
        "elective_remaining": max(0.0, 18.0 - elective_credits),
        "percent_complete": round((total / 36.0) * 100, 1) if total else 0.0,
    }

def _build_semester_plan(
    completed_ids: list[str],
    courses_per_semester: int,
    max_semesters: int,
    core_per_semester: int | None,
    elective_per_semester: int | None,
    relevance_query: str | None = None,
) -> dict:
    completed = {_normalize_id(x) for x in completed_ids if _normalize_id(x)}

    # Block other courses in only-one-of groups once one is completed/picked.
    blocked_ids: set[str] = set()
    seen_groups: set[tuple[str, ...]] = set()
    for cid in list(completed):
        grp = _only_one_group(cid)
        if grp:
            seen_groups.add(grp)
    for grp in seen_groups:
        for cid in grp:
            if cid not in completed:
                blocked_ids.add(cid)

    progress0 = _compute_progress_from_catalog(list(completed))
    core_remaining_courses = int(progress0["core_remaining"] // 3)
    elective_remaining_courses = int(progress0["elective_remaining"] // 3)

    all_core = [c for c in COURSE_MAP.values() if (c.get("course_type") or "").lower() == "core"]
    all_elec = [c for c in COURSE_MAP.values() if (c.get("course_type") or "").lower() == "elective"]

    def course_key(c: dict) -> str:
        return _normalize_id(c.get("course_id", ""))

    # Optional: use Pinecone relevance scores to rank picks toward the student's stated focus.
    score_by_id: dict[str, float] = {}
    if relevance_query:
        try:
            rel = query_courses(relevance_query, top_k=50)
            score_by_id = {str(c.get("course_id", "")).strip().upper(): float(c.get("score", 0) or 0) for c in rel}
        except Exception:
            score_by_id = {}

    def ranked_key(c: dict):
        cid = course_key(c)
        return (-float(score_by_id.get(cid, 0) or 0), cid)

    all_core.sort(key=ranked_key)
    all_elec.sort(key=ranked_key)

    semesters: list[dict] = []
    warnings: list[str] = []

    for sem in range(1, max_semesters + 1):
        if core_remaining_courses <= 0 and elective_remaining_courses <= 0:
            break

        if core_per_semester is None and elective_per_semester is None:
            total_remaining = core_remaining_courses + elective_remaining_courses
            if total_remaining == 0:
                break
            desired_core = round((core_remaining_courses / total_remaining) * courses_per_semester)
            desired_core = max(0, min(courses_per_semester, desired_core))
            desired_elec = courses_per_semester - desired_core
        else:
            desired_core = core_per_semester or 0
            desired_elec = elective_per_semester or 0
            if desired_core + desired_elec == 0:
                desired_core = courses_per_semester
                desired_elec = 0
            if desired_core + desired_elec != courses_per_semester:
                courses_per_semester = desired_core + desired_elec

        picked: list[dict] = []
        picked_ids: set[str] = set()

        def try_pick(pool: list[dict], n: int):
            for c in pool:
                if len([x for x in picked if (x.get("course_type") or "").lower() == (c.get("course_type") or "").lower()]) >= n:
                    return
                cid = _normalize_id(c.get("course_id"))
                if not cid or cid in completed or cid in blocked_ids or cid in picked_ids:
                    continue
                grp = _only_one_group(cid)
                if grp and grp in seen_groups:
                    continue
                if not _prereqs_met(cid, completed):
                    continue
                picked.append(c)
                picked_ids.add(cid)
                if grp:
                    seen_groups.add(grp)
                    for other in grp:
                        if other not in completed and other != cid:
                            blocked_ids.add(other)

        if desired_core > 0 and core_remaining_courses > 0:
            try_pick(all_core, min(desired_core, core_remaining_courses))
        if desired_elec > 0 and elective_remaining_courses > 0:
            try_pick(all_elec, min(desired_elec, elective_remaining_courses))

        if len(picked) < courses_per_semester:
            combined = all_core + all_elec
            for c in combined:
                if len(picked) >= courses_per_semester:
                    break
                cid = _normalize_id(c.get("course_id"))
                if not cid or cid in completed or cid in blocked_ids or cid in picked_ids:
                    continue
                if not _prereqs_met(cid, completed):
                    continue
                # Do not overfill beyond remaining degree requirements by type
                picked_core = len([x for x in picked if (x.get("course_type") or "").lower() == "core"])
                picked_elec = len([x for x in picked if (x.get("course_type") or "").lower() == "elective"])
                if _course_is_core(cid):
                    if core_remaining_courses <= 0:
                        continue
                    if picked_core >= core_remaining_courses:
                        continue
                if _course_is_elective(cid):
                    if elective_remaining_courses <= 0:
                        continue
                    if picked_elec >= elective_remaining_courses:
                        continue
                grp = _only_one_group(cid)
                if grp and grp in seen_groups:
                    continue
                picked.append(c)
                picked_ids.add(cid)
                if grp:
                    seen_groups.add(grp)
                    for other in grp:
                        if other not in completed and other != cid:
                            blocked_ids.add(other)

        if not picked:
            warnings.append(f"Semester {sem}: no additional eligible courses found with current prerequisites/constraints.")
            break

        for c in picked:
            cid = _normalize_id(c.get("course_id"))
            completed.add(cid)
            if _course_is_core(cid) and core_remaining_courses > 0:
                core_remaining_courses -= 1
            elif _course_is_elective(cid) and elective_remaining_courses > 0:
                elective_remaining_courses -= 1

        semesters.append({
            "semester": sem,
            "courses": [
                {
                    "course_id": c.get("course_id"),
                    "title": c.get("title"),
                    "course_type": c.get("course_type"),
                    "credits": c.get("credits", 3),
                    "prerequisites": c.get("prerequisites") or [],
                    "only_one_of_these": c.get("only_one_of_these") or [],
                }
                for c in picked
            ],
        })

    final_progress = _compute_progress_from_catalog(list(completed))
    return {"plan": semesters, "warnings": warnings, "progress": final_progress}


@router.post("/plan")
def degree_planner_plan(request: PlanRequest):
    from_hist: list[str] = []
    if isinstance(request.course_history, list):
        for item in request.course_history:
            if isinstance(item, dict) and isinstance(item.get("course"), str):
                from_hist.append(item["course"])
    validation = validate_course_list(list(request.completed_courses or []) + from_hist)
    completed_ids = list(dict.fromkeys(c["course_id"] for c in validation["valid"]))

    plan = _build_semester_plan(
        completed_ids=completed_ids,
        courses_per_semester=max(1, int(request.courses_per_semester)),
        max_semesters=max(1, int(request.max_semesters)),
        core_per_semester=request.core_per_semester,
        elective_per_semester=request.elective_per_semester,
        relevance_query=" ".join(request.interests) if request.interests else None,
    )

    hist_info = _analyze_course_history(
        list(request.course_history) if isinstance(request.course_history, list) else []
    )
    headings = _headings_for_plan_rows(hist_info, len(plan["plan"]))

    return {
        "plan": plan["plan"],
        "warnings": plan["warnings"],
        "progress": plan["progress"],
        "invalid_courses": validation["invalid"],
        "next_semester_label": hist_info.get("next_label"),
        "semester_headings": headings,
    }


def _select_courses(
    eligible: list[dict],
    relevant: list[dict],
    n_core: int | None,
    n_elective: int | None,
    max_total: int | None,
) -> tuple[list[dict], list[str]]:
    """
    Deterministically pick a semester plan from eligible courses.
    Uses Pinecone relevance scores when available, but never changes course_type.
    Enforces only-one-of groups (doesn't pick 2 from same group).
    Returns (selected_courses, warnings).
    """
    score_by_id = {c["course_id"].strip().upper(): c.get("score", 0) for c in relevant if c.get("course_id")}

    def rank_key(c: dict):
        cid = c["course_id"].strip().upper()
        return (-float(score_by_id.get(cid, 0) or 0), cid)

    eligible_core = [c for c in eligible if str(c.get("course_type", "")).lower() == "core"]
    eligible_elec = [c for c in eligible if str(c.get("course_type", "")).lower() == "elective"]
    eligible_core.sort(key=rank_key)
    eligible_elec.sort(key=rank_key)

    selected: list[dict] = []
    warnings: list[str] = []
    seen_groups: set[tuple[str, ...]] = set()
    seen_ids: set[str] = set()

    def take_from(pool: list[dict], n: int):
        nonlocal selected
        added = 0
        for c in pool:
            if added >= n:
                return
            if len(selected) >= (max_total or 10**9):
                return
            cid = c["course_id"].strip().upper()
            if cid in seen_ids:
                continue
            grp = _only_one_group(cid)
            if grp and grp in seen_groups:
                continue
            selected.append(c)
            seen_ids.add(cid)
            if grp:
                seen_groups.add(grp)
            added += 1

    # If user specified counts, honor them
    if n_core is not None:
        take_from(eligible_core, n_core)
        if len([c for c in selected if str(c.get("course_type", "")).lower() == "core"]) < n_core:
            warnings.append("Not enough eligible CORE courses to satisfy the requested count.")
    if n_elective is not None:
        take_from(eligible_elec, n_elective)
        if len([c for c in selected if str(c.get("course_type", "")).lower() == "elective"]) < n_elective:
            warnings.append("Not enough eligible ELECTIVE courses to satisfy the requested count.")

    # If total was specified, fill remaining from best-ranked eligible (any type)
    if max_total is not None and len(selected) < max_total:
        combined = sorted(eligible_core + eligible_elec, key=rank_key)
        for c in combined:
            if len(selected) >= max_total:
                break
            cid = c["course_id"].strip().upper()
            if cid in seen_ids:
                continue
            grp = _only_one_group(cid)
            if grp and grp in seen_groups:
                continue
            selected.append(c)
            seen_ids.add(cid)
            if grp:
                seen_groups.add(grp)

    if max_total is not None and len(selected) < max_total:
        warnings.append(
            f"Only {len(selected)} eligible course(s) could be selected out of the {max_total} requested "
            "due to prerequisites/constraints."
        )

    return selected, warnings


@router.post("/chat")
def degree_planner_chat(request: ChatRequest):
    # Course details/prereqs: answer deterministically from catalog when asked.
    mentioned_ids = [cid.strip().upper() for cid in extract_course_ids(request.message)]
    if mentioned_ids:
        msg_lower = request.message.lower()
        wants_details = any(k in msg_lower for k in ["prereq", "prerequisite", "tell me about", "what is", "describe"])
        if wants_details:
            cid = mentioned_ids[0]
            course = COURSE_MAP.get(cid)
            if course:
                prereqs = course.get("prerequisites") or []
                only_one = course.get("only_one_of_these") or []
                skills = course.get("skills_taught") or []
                desc = (course.get("description") or "").strip() or "N/A"
                response = (
                    f"{course['course_id']} — {course['title']}\n"
                    f"Type: {course.get('course_type', 'N/A')} | Credits: {course.get('credits', 3)}\n\n"
                    f"Description:\n{desc}\n\n"
                    f"Prerequisites:\n{_format_prereqs(prereqs)}\n\n"
                    f"Only One Of These group:\n{', '.join(only_one) if only_one else 'None'}\n\n"
                    f"Skills taught (high level):\n{', '.join(skills) if skills else 'N/A'}"
                )
                return {
                    "response": response,
                    "corrections": [],
                    "removed": [],
                    "progress": {
                        "total_completed": 0,
                        "core_completed": 0,
                        "elective_completed": 0,
                        "total_remaining": 36,
                        "core_remaining": 18,
                        "elective_remaining": 18,
                        "percent_complete": 0,
                    },
                    "invalid_courses": [],
                    "eligible_count": 0,
                }

    # Step 1 — validate student's completed courses (from payload + optional course_history)
    from_history = []
    if isinstance(request.course_history, list):
        for item in request.course_history:
            if isinstance(item, dict) and isinstance(item.get("course"), str):
                from_history.append(item["course"])

    validation = validate_course_list(
        list(request.completed_courses or []) + from_history
    )
    valid_completed = list(dict.fromkeys(c["course_id"] for c in validation["valid"]))

    hist_info = _analyze_course_history(
        list(request.course_history) if isinstance(request.course_history, list) else []
    )

    # If user is asking for a full path/schedule, use deterministic planner.
    # Be strict so we don't generate a plan "randomly" during normal chat.
    msg_lower = request.message.lower()
    wants_path = any(k in msg_lower for k in [
        "plan out my degree",
        "map my degree",
        "degree plan",
        "semester by semester",
        "path to graduation",
        "roadmap to graduation",
        "schedule my courses",
    ])
    if wants_path:
        prefs = _extract_preferences_from_convo(request.conversation_history, request.message)
        merged_completed = sorted(set(valid_completed) | set(prefs["completed_from_convo"]))
        plan_out = _build_semester_plan(
            completed_ids=merged_completed,
            courses_per_semester=max(1, int(prefs["courses_per_semester"])),
            max_semesters=8,
            core_per_semester=prefs["core_per_semester"],
            elective_per_semester=prefs["elective_per_semester"],
            relevance_query=(" ".join(request.interests) if request.interests else prefs["focus_query"]),
        )
        # Format a chatbot-friendly response deterministically (no LLM needed).
        lines = []
        lines.append(f"Got it — here’s a semester-by-semester plan with {prefs['courses_per_semester']} course(s) per semester, based on what you shared so far.")
        if hist_info.get("next_label"):
            lines.append(f"Next terms start at: {hist_info['next_label']} (from your reported course history).")
        lines.append("")
        plan_rows = plan_out["plan"][:8]
        headings = _headings_for_plan_rows(hist_info, len(plan_rows))
        for i, sem in enumerate(plan_rows):
            label = headings[i] if i < len(headings) else f"Semester {sem['semester']}"
            lines.append(f"{label}:")
            for c in sem["courses"]:
                lines.append(f"- {c['course_id']} — {c['title']} ({c['course_type']})")
            lines.append("")
        if plan_out["warnings"]:
            lines.append("Notes:")
            for w in plan_out["warnings"]:
                lines.append(f"- {w}")
            lines.append("")
        return {
            "response": "\n".join(lines).strip(),
            "corrections": [],
            "removed": [],
            "progress": plan_out["progress"],
            "invalid_courses": validation["invalid"],
            "eligible_count": 0,
            "plan": plan_out["plan"],
            "warnings": plan_out["warnings"],
        }

    # Step 2/3 — get eligible courses from Neo4j
    try:
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

    # Canonical types + eligible next steps from graph
    eligible_courses = [_enrich_course_record(c) for c in eligible_courses]

    requested_type = _detect_requested_course_type(request.message)

    # Pre-compute remaining lists (strict Core vs Elective) before LLM context is built.
    remaining_core, remaining_elective, progress, list_notes = build_course_lists(
        valid_completed_ids=valid_completed,
        all_courses=_ALL_COURSES,
    )
    remaining_core, remaining_elective, group_notes = _apply_only_one_of_constraints(
        completed_ids=valid_completed,
        remaining_core=remaining_core,
        remaining_elective=remaining_elective,
    )
    list_notes = (list_notes or []) + (group_notes or [])
    # Do not override Neo4j eligibility for new students with a tiny Pinecone slice.
    # Step 4 — semantic search for query-relevant courses
    relevant_courses = query_courses(request.message, top_k=8)
    relevant_courses = [_enrich_course_record(c) for c in relevant_courses]

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
        courses_to_show = eligible_courses[:12]

    # If user asked for a specific mix (e.g. "2 core and 1 elective"), select deterministically.
    mix = _parse_course_mix(request.message)
    selected_plan = None
    plan_warnings: list[str] = []
    if mix and (mix.get("core") is not None or mix.get("elective") is not None or mix.get("total") is not None):
        selected_plan, plan_warnings = _select_courses(
            eligible=eligible_courses,
            relevant=relevant_courses,
            n_core=mix.get("core"),
            n_elective=mix.get("elective"),
            max_total=mix.get("total") or (None if (mix.get("core") is None and mix.get("elective") is None) else (mix.get("core") or 0) + (mix.get("elective") or 0)),
        )

    # Step 6 — build context for LLM
    chat_plan_note = ""
    if valid_completed:
        chat_plan_note = (
            "\nPLAN / HISTORY — courses already listed in this chat (use for sequencing; "
            "do not say the student has no prior coursework if this list is non-empty):\n- "
            + "\n- ".join(sorted({str(x).strip().upper() for x in valid_completed}))
        )

    history_ctx = ""
    if hist_info.get("lines"):
        history_ctx = (
            "\nSTUDENT-REPORTED COURSE HISTORY (each row: course and when they took it):\n"
            + "\n".join(hist_info["lines"])
        )
    if hist_info.get("next_label"):
        history_ctx += (
            f"\nNEXT PLANNING TERM: {hist_info['next_label']}\n"
            "When you suggest the next schedule, use that term in the section heading. "
            "Do not restart numbering from Semester 1 or an earlier calendar term unless the student has no history above.\n"
        )

    progress_context = f"""
STUDENT DEGREE PROGRESS:
- Total credits completed: {progress['total_completed']} / 36
- Core credits completed: {progress['core_completed']} / 18
- Elective credits completed: {progress['elective_completed']} / 18
- Credits remaining: {progress['total_remaining']}
- Core remaining: {progress['core_remaining']}
- Elective remaining: {progress['elective_remaining']}
- Percent complete: {progress['percent_complete']}%{chat_plan_note}{history_ctx}
    """.strip()

    def _format_course_line(c: dict) -> str:
        cc = _enrich_course_record(c)
        cid = str(cc.get("course_id") or "").strip()
        title = str(cc.get("title") or "").strip()
        credits = cc.get("credits", 3)
        return f"{cid} | {title} | {credits}"

    remaining_core_context = "\n".join(_format_course_line(c) for c in remaining_core)
    remaining_elective_context = "\n".join(_format_course_line(c) for c in remaining_elective)

    rules_notes_context = ""
    if list_notes:
        rules_notes_context = "ONLY-ONE-OF CONSTRAINT NOTES:\n" + "\n".join(f"- {n}" for n in list_notes) + "\n\n"

    warnings_context = ""
    if plan_warnings:
        warnings_context = "\n".join([f"PLAN WARNING: {w}" for w in plan_warnings]) + "\n\n"

    plan_context = ""
    if selected_plan:
        plan_lines = [
            f"- {c['course_id']} | {c['title']} | {c.get('course_type', '')}"
            for c in selected_plan
        ]
        term_line = ""
        if hist_info.get("next_label"):
            term_line = (
                f"TARGET TERM FOR THIS SELECTION: {hist_info['next_label']}\n"
                f"Present these courses under a single heading for that term (not Semester 1 / a past term).\n\n"
            )
        plan_context = (
            term_line
            + "SELECTED SEMESTER PLAN (FIXED) — DO NOT CHANGE TYPES OR IDS:\n"
            + "\n".join(plan_lines)
            + "\n\n"
            "INSTRUCTIONS:\n"
            "- If a fixed plan is provided, present ALL courses in that plan as your recommendation.\n"
            "- Keep it chatty and concise (like a modern chatbot).\n"
            "- Do NOT invent or swap courses.\n\n"
        )

    type_turn_rules = ""
    if requested_type == "Core":
        type_turn_rules = (
            "THIS TURN IS CORE-ONLY: Recommend ONLY from the REMAINING CORE COURSES list.\n\n"
        )
    elif requested_type == "Elective":
        type_turn_rules = (
            "THIS TURN IS ELECTIVE-ONLY: Recommend ONLY from the REMAINING ELECTIVE COURSES (prerequisites met) list.\n\n"
        )

    system_prompt_with_context = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{progress_context}\n\n"
        f"REQUEST TYPE: {requested_type or 'Any'}\n"
        f"{type_turn_rules}"
        f"{rules_notes_context}"
        f"REMAINING CORE COURSES — student must complete these for their core requirement.\n"
        f"Recommend ONLY from this list when the student asks about core courses.\n"
        f"Never move a course from this list into the elective section.\n"
        f"Format: COURSE_ID | EXACT_TITLE | credits\n\n"
        f"{remaining_core_context}\n\n"
        f"REMAINING ELECTIVE COURSES (prerequisites met) — student can freely choose from these.\n"
        f"Recommend ONLY from this list when the student asks about elective courses.\n"
        f"Never move a course from this list into the core section.\n"
        f"Format: COURSE_ID | EXACT_TITLE | credits\n\n"
        f"{remaining_elective_context}\n\n"
        f"{warnings_context}"
        f"{plan_context}"
        "The course type labels (Core/Elective) are FINAL and come from the database. "
        "Never reclassify a course. Never recommend the same course in both sections. "
        "Never recommend a course the student has already completed."
    )

    # Step 7 — build conversation history
    messages = request.conversation_history + [
        {"role": "user", "content": request.message}
    ]

    # Step 8 — get LLM response with validation
    result = chat(
        system_prompt=system_prompt_with_context,
        messages=messages,
    )

    return {
        "response":           result["text"],
        "corrections":        result["corrections"],
        "removed":            result["removed"],
        "progress":           progress,
        "invalid_courses":    validation["invalid"],
        "eligible_count":     len(eligible_courses)
    }