import json
import os


_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "programs")


def load_rules(program_id: str) -> dict:
    pid = (program_id or "").strip().lower()
    if not pid:
        raise ValueError("program_id is required")
    path = os.path.join(_BASE_DIR, pid, "rules.json")
    if not os.path.exists(path):
        raise FileNotFoundError(f"rules.json not found for program_id={pid!r}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_only_one_of_these_groups(program_id: str) -> list[list[str]]:
    rules = load_rules(program_id)
    groups = rules.get("only_one_of_these_groups") or []
    out: list[list[str]] = []
    for g in groups:
        if isinstance(g, list) and g:
            out.append([str(x).strip().upper().replace("  ", " ") for x in g if str(x).strip()])
    return out


def get_credit_requirements(program_id: str) -> dict:
    rules = load_rules(program_id)
    return {
        "total_credits": float(rules.get("total_credits", 0) or 0),
        "core_credits": float(rules.get("core_credits", 0) or 0),
        "core_elective_credits": float(rules.get("core_elective_credits", 0) or 0),
        "elective_credits": float(rules.get("elective_credits", 0) or 0),
        "credits_per_course": float(rules.get("credits_per_course", 3) or 3),
    }


def get_core_elective_rules(program_id: str) -> dict:
    rules = load_rules(program_id)
    return {
        "core_elective_credits": float(rules.get("core_elective_credits", 0) or 0),
        "tracks_required": int(rules.get("core_elective_tracks_required", 0) or 0),
        "rule_description": rules.get("core_elective_rule", ""),
    }


def get_program_name(program_id: str) -> str:
    rules = load_rules(program_id)
    return rules.get("program_name", program_id.upper())


def get_required_non_credit(program_id: str) -> list[str]:
    rules = load_rules(program_id)
    raw = rules.get("required_non_credit") or []
    return [str(x).strip().upper() for x in raw if str(x).strip()]


def get_conditional_prerequisites(program_id: str) -> list[dict]:
    rules = load_rules(program_id)
    raw = rules.get("conditional_prerequisites") or []
    return [x for x in raw if isinstance(x, dict)]


def get_internship_rules(program_id: str) -> dict:
    rules = load_rules(program_id)
    return rules.get("required_internship") or {}

