import os
import json
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

URI      = os.getenv("NEO4J_URI")
USERNAME = os.getenv("NEO4J_USERNAME")
PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

# ── Load Data ─────────────────────────────────────────────────────────────────

def load_graph(courses: list[dict]):
    with driver.session() as session:
        # Clear existing data
        session.run("MATCH (n) DETACH DELETE n")

        # Step 1 — collect ALL course IDs including prerequisites
        # that may not be in the MSBA catalog
        all_ids = set()
        for course in courses:
            all_ids.add(course["course_id"])
            prereq_groups = course.get("prerequisites") or []
            if not prereq_groups:
                continue
            if not isinstance(prereq_groups[0], list):
                prereq_groups = [prereq_groups]
            for group in prereq_groups:
                for prereq_id in group:
                    all_ids.add(prereq_id.strip())

        # Step 2 — create nodes for ALL course IDs
        # MSBA courses get full data, external prereqs get placeholder nodes
        msba_map = {c["course_id"]: c for c in courses}

        for course_id in all_ids:
            if course_id in msba_map:
                c = msba_map[course_id]
                session.run("""
                    MERGE (c:Course {course_id: $course_id})
                    SET c.title       = $title,
                        c.credits     = $credits,
                        c.course_type = $course_type,
                        c.description = $description,
                        c.programs    = $programs,
                        c.course_track = $course_track,
                        c.is_external = false
                """, {
                    "course_id":   c["course_id"],
                    "title":       c["title"],
                    "credits":     float(c.get("credits", 3) or 3),
                    "course_type": c["course_type"],
                    "description": c.get("description") or "",
                    "programs":    c.get("programs") or [],
                    "course_track": c.get("course_track") or "",
                })
            else:
                # External prerequisite — create placeholder node
                session.run("""
                    MERGE (c:Course {course_id: $course_id})
                    SET c.title       = $course_id,
                        c.credits     = 3.0,
                        c.course_type = 'External',
                        c.description = 'Prerequisite course from outside MSBA catalog',
                        c.is_external = true
                """, {"course_id": course_id})

        print(f"  [ok] Created {len(all_ids)} course nodes "
              f"({len(msba_map)} MSBA + "
              f"{len(all_ids) - len(msba_map)} external prerequisites)")

        # Step 3 — create prerequisite relationships
        rel_count = 0
        for course in courses:
            prereq_groups = course.get("prerequisites") or []
            if not prereq_groups:
                continue

            # Normalize to list of lists
            if not isinstance(prereq_groups[0], list):
                prereq_groups = [prereq_groups]

            for group_index, group in enumerate(prereq_groups):
                for prereq_id in group:
                    session.run("""
                        MATCH (prereq:Course {course_id: $prereq_id})
                        MATCH (course:Course {course_id: $course_id})
                        MERGE (prereq)-[r:PREREQUISITE_FOR]->(course)
                        SET r.group_index = $group_index,
                            r.type        = 'one_of'
                    """, {
                        "prereq_id":   prereq_id.strip(),
                        "course_id":   course["course_id"],
                        "group_index": group_index
                    })
                    rel_count += 1

        print(f"  [ok] Created {rel_count} prerequisite relationships")

    print(f"[done] Graph loaded successfully")


# ── Query Helpers ─────────────────────────────────────────────────────────────

def get_prerequisites(course_id: str) -> list[list[str]]:
    """
    Returns the prerequisite groups for a course.
    Each inner list is a group where ONE course satisfies the requirement.
    e.g. [[A, B], [C, D]] means: (one of A,B) AND (one of C,D)
    """
    with driver.session() as session:
        result = session.run("""
            MATCH (prereq:Course)-[r:PREREQUISITE_FOR]->(c:Course {course_id: $course_id})
            RETURN prereq.course_id AS prereq_id,
                   r.group_index   AS group_index
            ORDER BY r.group_index
        """, {"course_id": course_id})

        groups = {}
        for record in result:
            idx = record["group_index"]
            if idx not in groups:
                groups[idx] = []
            groups[idx].append(record["prereq_id"])

        return list(groups.values()) if groups else []


def get_all_prerequisites_recursive(course_id: str) -> list[str]:
    """
    Returns ALL prerequisites recursively for a course
    (the full chain, not just direct prerequisites).
    Uses Neo4j's variable length path query.
    """
    with driver.session() as session:
        result = session.run("""
            MATCH (prereq:Course)-[:PREREQUISITE_FOR*1..]->(c:Course {course_id: $course_id})
            RETURN DISTINCT prereq.course_id AS prereq_id,
                            prereq.title     AS title
        """, {"course_id": course_id})

        return [
            {"course_id": r["prereq_id"], "title": r["title"]}
            for r in result
        ]


def get_courses_unlocked_by(course_id: str) -> list[dict]:
    """
    Returns all courses that become available after completing
    a given course — i.e. courses this course is a prerequisite for.
    """
    with driver.session() as session:
        result = session.run("""
            MATCH (c:Course {course_id: $course_id})-[:PREREQUISITE_FOR]->(unlocked:Course)
            RETURN unlocked.course_id AS course_id,
                   unlocked.title     AS title,
                   unlocked.credits   AS credits,
                   unlocked.course_type AS course_type
        """, {"course_id": course_id})

        return [
            {
                "course_id":   r["course_id"],
                "title":       r["title"],
                "credits":     r["credits"],
                "course_type": r["course_type"]
            }
            for r in result
        ]


def check_prerequisites_met(
    course_id: str,
    completed_course_ids: list[str]
) -> dict:
    """
    Checks whether a student has met the prerequisites
    for a given course based on their completed courses.
    Returns whether eligible and what's missing if not.
    """
    prereq_groups = get_prerequisites(course_id)

    if not prereq_groups:
        return {"eligible": True, "missing": []}

    completed = set(c.strip().upper() for c in completed_course_ids)
    missing_groups = []

    for group in prereq_groups:
        group_upper = [c.strip().upper() for c in group]
        # Student needs at least ONE from this group
        if not any(c in completed for c in group_upper):
            missing_groups.append(group)

    if missing_groups:
        return {
            "eligible": False,
            "missing":  missing_groups  # list of groups, need one from each
        }

    return {"eligible": True, "missing": []}


def get_valid_next_courses(
    completed_course_ids: list[str],
    course_type_filter: str = None,
    program_id: str = None
) -> list[dict]:
    """
    Returns all courses a student is currently eligible
    to take based on their completed courses.
    Optionally filter by 'Core' or 'Elective'.
    """
    with driver.session() as session:
        result = session.run("""
            MATCH (c:Course)
            WHERE NOT c.course_id IN $completed
            AND ($program_id IS NULL OR $program_id IN c.programs)
            AND c.is_external = false
            RETURN c.course_id   AS course_id,
                   c.title       AS title,
                   c.credits     AS credits,
                   c.course_type AS course_type,
                   c.course_track AS course_track
        """, {"completed": completed_course_ids, "program_id": program_id})

        all_remaining = [
            {
                "course_id":   r["course_id"],
                "title":       r["title"],
                "credits":     r["credits"],
                "course_type": r["course_type"],
                "course_track": r["course_track"],
            }
            for r in result
        ]

    # Filter to only courses whose prerequisites are met
    eligible = []
    for course in all_remaining:
        check = check_prerequisites_met(
            course["course_id"],
            completed_course_ids
        )
        if check["eligible"]:
            if course_type_filter is None or \
               (course["course_type"] or "").lower() == course_type_filter.lower():
                eligible.append(course)

    return eligible


def get_degree_progress(completed_course_ids: list[str]) -> dict:
    """
    Calculates a student's degree progress.
    Returns credits completed, remaining, and breakdown by type.
    """
    if not completed_course_ids:
        return {
            "total_completed":    0,
            "core_completed":     0,
            "elective_completed": 0,
            "total_remaining":    36,
            "core_remaining":     18,
            "elective_remaining": 18,
            "percent_complete":   0
        }

    with driver.session() as session:
        result = session.run("""
            MATCH (c:Course)
            WHERE c.course_id IN $completed
            RETURN c.course_type AS course_type,
                   sum(c.credits) AS total_credits
        """, {"completed": completed_course_ids})

        core_credits     = 0
        elective_credits = 0

        for record in result:
            if record["course_type"].lower() == "core":
                core_credits = record["total_credits"] or 0
            else:
                elective_credits = record["total_credits"] or 0

    total_completed = core_credits + elective_credits

    return {
        "total_completed":    total_completed,
        "core_completed":     core_credits,
        "elective_completed": elective_credits,
        "total_remaining":    36 - total_completed,
        "core_remaining":     max(0, 18 - core_credits),
        "elective_remaining": max(0, 18 - elective_credits),
        "percent_complete":   round((total_completed / 36) * 100, 1)
    }


def close():
    driver.close()