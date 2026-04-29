import json
import os


def _normalize_course(c: dict, program: str):
    c = dict(c)
    c["course_id"] = (c.get("course_id") or "").strip().upper()
    if not c["course_id"]:
        return None
    if c.get("prerequisites") is None:
        c["prerequisites"] = []
    if c.get("only_one_of_these") is None:
        c["only_one_of_these"] = []
    if c.get("skills_taught") is None:
        c["skills_taught"] = []
    c["programs"] = [program]
    c["course_track"] = c.get("course_track") if program == "msitm" else None
    c["course_tracks"] = c.get("course_tracks") or []
    return c


def _load(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def main():
    root = os.path.join(os.path.dirname(__file__), "..", "data")
    courses_dir = os.path.join(root, "courses")
    os.makedirs(courses_dir, exist_ok=True)

    old_msba = os.path.join(root, "courses.json")
    msba_path = os.path.join(courses_dir, "msba_courses.json")
    msitm_path = os.path.join(courses_dir, "msitm_courses.json")
    shared_path = os.path.join(courses_dir, "shared_courses.json")

    if os.path.exists(old_msba):
        msba_raw = _load(old_msba)
    elif os.path.exists(msba_path):
        msba_raw = _load(msba_path)
    else:
        raise FileNotFoundError("Could not locate MSBA courses source.")

    if not os.path.exists(msitm_path):
        raise FileNotFoundError("Missing msitm_courses.json. Run deduplicate_msitm.py first.")
    msitm_raw = _load(msitm_path)

    msba = [_normalize_course(c, "msba") for c in msba_raw]
    msba = [c for c in msba if c]
    msitm = [_normalize_course(c, "msitm") for c in msitm_raw]
    msitm = [c for c in msitm if c]

    msba_by_id = {c["course_id"]: c for c in msba}
    msitm_by_id = {c["course_id"]: c for c in msitm}

    shared_ids = []
    for cid in set(msba_by_id).intersection(msitm_by_id):
        if (msba_by_id[cid].get("course_type") or "") == (msitm_by_id[cid].get("course_type") or ""):
            shared_ids.append(cid)

    shared = []
    for cid in sorted(shared_ids):
        # prefer msba payload as base when compatible
        c = dict(msba_by_id[cid])
        c["programs"] = ["msba", "msitm"]
        # shared course should preserve track data only if present in both; keep neutral default
        c["course_track"] = None
        c["course_tracks"] = []
        shared.append(c)

    msba_out = [c for c in msba if c["course_id"] not in shared_ids]
    msitm_out = [c for c in msitm if c["course_id"] not in shared_ids]

    _write(msba_path, msba_out)
    _write(msitm_path, msitm_out)
    _write(shared_path, shared)

    if os.path.exists(old_msba):
        os.remove(old_msba)

    cert_dir = os.path.join(root, "certificates")
    os.makedirs(cert_dir, exist_ok=True)
    msitm_certs = os.path.join(cert_dir, "msitm_certs.json")
    if not os.path.exists(msitm_certs):
        _write(msitm_certs, [])

    programs_dir = os.path.join(root, "programs")
    os.makedirs(os.path.join(programs_dir, "msba"), exist_ok=True)
    os.makedirs(os.path.join(programs_dir, "msitm"), exist_ok=True)

    msba_rules = {
        "program_id": "msba",
        "program_name": "MS in Business Analytics and Artificial Intelligence",
        "total_credits": 36,
        "core_credits": 18,
        "core_elective_credits": 0,
        "elective_credits": 18,
        "credits_per_course": 3,
        "core_elective_tracks_required": 0,
        "core_elective_rule": "",
        "only_one_of_these_groups": [["BUAN 6324", "BUAN 6356", "BUAN 6383"]],
        "required_non_credit": ["MAS 6102"],
        "gpa_requirement": 3.0,
        "admission_semesters": ["Fall", "Spring", "Summer"],
    }
    msitm_rules = {
        "program_id": "msitm",
        "program_name": "MS in Information Technology and Management",
        "total_credits": 36,
        "core_credits": 9,
        "core_elective_credits": 9,
        "elective_credits": 18,
        "credits_per_course": 3,
        "core_elective_tracks_required": 3,
        "core_elective_rule": "Student must complete exactly 3 CoreElective courses, each from a different domain track",
        "only_one_of_these_groups": [
            ["BUAN 6320", "MIS 6326", "SYSM 6338", "ACCT 6320", "ACCT 6321", "MIS 6320", "OPRE 6393"],
            ["OPRE 6301", "OPRE 6359", "BUAN 6359"],
            ["ACCT 6301", "ACCT 6202", "ACCT 6305"],
        ],
        "required_non_credit": [],
        "gpa_requirement": 3.0,
        "admission_semesters": ["Fall", "Spring", "Summer"],
    }
    _write(os.path.join(programs_dir, "msba", "rules.json"), msba_rules)
    _write(os.path.join(programs_dir, "msitm", "rules.json"), msitm_rules)

    print(f"MSBA courses: {len(msba_out)}")
    print(f"MSITM courses: {len(msitm_out)}")
    print(f"Shared courses: {len(shared)}")


if __name__ == "__main__":
    main()
