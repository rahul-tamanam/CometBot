"""
gap_engine.py

Core gap analysis logic — pure functions, no I/O.

Weighting:
- Technical skills: weight 1.0
- Soft skills: weight 0.5

Score = (weighted_matched / weighted_total) * 100
"""

from __future__ import annotations
from dataclasses import dataclass, field

TECH_WEIGHT = 1.0
SOFT_WEIGHT = 0.5


@dataclass
class SkillGap:
    resume_skills: list[str]
    required_technical: list[str]
    required_soft: list[str]
    matched_technical: list[str] = field(default_factory=list)
    matched_soft: list[str] = field(default_factory=list)
    missing_technical: list[str] = field(default_factory=list)
    missing_soft: list[str] = field(default_factory=list)
    match_score: float = 0.0      # 0.0–1.0
    match_percent: float = 0.0    # 0–100
    total_required: int = 0
    total_matched: int = 0


def compute_gap(
    resume_skills: list[str],
    required_technical: list[str],
    required_soft: list[str],
    partial_technical: list[str] | None = None,
    tech_weight: float = TECH_WEIGHT,
    soft_weight: float = SOFT_WEIGHT,
) -> SkillGap:
    """All inputs must already be normalized."""
    resume_set = {s.lower().strip() for s in resume_skills}
    partial_set = {s.lower().strip() for s in (partial_technical or [])}

    matched_tech = [s for s in required_technical if s.lower().strip() in resume_set]
    # If a skill is already adjacent/partial, treat it as "not missing" for clarity.
    missing_tech = [
        s for s in required_technical
        if s.lower().strip() not in resume_set
        and s.lower().strip() not in partial_set
    ]
    matched_soft = [s for s in required_soft if s.lower().strip() in resume_set]
    missing_soft = [s for s in required_soft if s.lower().strip() not in resume_set]
    partial_tech_in_required = [
        s for s in required_technical
        if s.lower().strip() in partial_set and s.lower().strip() not in {m.lower().strip() for m in matched_tech}
    ]

    w_matched = (
        len(matched_tech) * tech_weight
        + (0.5 * len(partial_tech_in_required)) * tech_weight
        + len(matched_soft) * soft_weight
    )
    w_total = len(required_technical) * tech_weight + len(required_soft) * soft_weight
    score = round((w_matched / w_total) * 100, 1) if w_total > 0 else 0.0

    return SkillGap(
        resume_skills=resume_skills,
        required_technical=required_technical,
        required_soft=required_soft,
        matched_technical=matched_tech,
        matched_soft=matched_soft,
        missing_technical=missing_tech,
        missing_soft=missing_soft,
        match_score=round(score / 100, 3),
        match_percent=score,
        total_required=len(required_technical) + len(required_soft),
        total_matched=len(matched_tech) + len(matched_soft),
    )


def prioritize_gaps(gap: SkillGap) -> list[dict]:
    """Rank missing skills by impact: first 3 technical = high, rest = medium, soft = low."""
    out: list[dict] = []
    top3 = set(gap.missing_technical[:3])
    for s in gap.missing_technical:
        out.append({"skill": s, "priority": "high" if s in top3 else "medium", "type": "technical"})
    for s in gap.missing_soft:
        out.append({"skill": s, "priority": "low", "type": "soft"})
    return out
