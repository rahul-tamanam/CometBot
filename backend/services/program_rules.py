import json
import os


_BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "programs")


def load_rules(program_id: str) -> dict:
    """
    Loads backend/data/programs/<program_id>/rules.json
    """
    pid = (program_id or "").strip().lower()
    if not pid:
        raise ValueError("program_id is required")
    path = os.path.join(_BASE_DIR, pid, "rules.json")
    if not os.path.exists(path):
        raise FileNotFoundError(f"rules.json not found for program_id={pid}")
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
        "elective_credits": float(rules.get("elective_credits", 0) or 0),
        "credits_per_course": float(rules.get("credits_per_course", 3) or 3),
    }

