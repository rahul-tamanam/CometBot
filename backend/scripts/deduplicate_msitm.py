import json
import os


def main():
    base = os.path.join(os.path.dirname(__file__), "..", "data")
    raw_path = os.path.join(base, "courses", "msitm_courses_raw.json")
    legacy_raw_path = os.path.join(base, "courses msitm.json")
    out_dir = os.path.join(base, "courses")
    out_path = os.path.join(out_dir, "msitm_courses.json")

    source = raw_path if os.path.exists(raw_path) else legacy_raw_path
    if not os.path.exists(source):
        raise FileNotFoundError(
            "MSITM raw file not found. Expected one of:\n"
            f"- {raw_path}\n"
            f"- {legacy_raw_path}"
        )

    with open(source, encoding="utf-8") as f:
        raw = json.load(f)

    merged: dict[str, dict] = {}
    for course in raw:
        cid = course.get("course_id")
        if not cid or not isinstance(cid, str) or not cid.strip():
            continue
        cid = cid.strip().upper()
        if cid not in merged:
            course["course_id"] = cid
            course["programs"] = ["msitm"]
            course["course_tracks"] = []
            track = course.get("course_track")
            if track and track not in course["course_tracks"]:
                course["course_tracks"].append(track)
            if course.get("prerequisites") is None:
                course["prerequisites"] = []
            if course.get("only_one_of_these") is None:
                course["only_one_of_these"] = []
            if course.get("skills_taught") is None:
                course["skills_taught"] = []
            merged[cid] = course
        else:
            existing = merged[cid]
            track = course.get("course_track")
            if track and track not in existing["course_tracks"]:
                existing["course_tracks"].append(track)
            if len(course.get("skills_taught") or []) > len(existing.get("skills_taught") or []):
                existing["skills_taught"] = course["skills_taught"]

    os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(list(merged.values()), f, indent=2)

    print(f"Done. {len(merged)} unique courses written.")


if __name__ == "__main__":
    main()
