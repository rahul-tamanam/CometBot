"""
skill_normalizer.py

Maps raw skill strings (from resume heuristics, LLM output, or skills.json)
to canonical names so gap comparison is reliable regardless of casing,
abbreviations, or minor phrasing differences.
"""

import re

SYNONYM_GROUPS: list[tuple[str, list[str]]] = [
    ("Machine Learning", ["machine learning", "ml", "maching learning"]),
    ("Deep Learning", ["deep learning", "dl"]),
    ("Natural Language Processing", ["natural language processing", "nlp", "text mining", "text analytics"]),
    ("Python", ["python", "python3", "python 3"]),
    ("R", ["r", "r programming", "r language"]),
    ("SQL", ["sql", "mysql", "postgresql", "postgres", "t-sql", "plsql", "pl/sql", "sql server", "sqlite"]),
    ("Scala", ["scala"]),
    ("Java", ["java"]),
    ("JavaScript", ["javascript", "js", "node.js", "nodejs"]),
    ("Data Visualization", ["data visualization", "data viz", "visualization", "dataviz"]),
    ("Tableau", ["tableau"]),
    ("Power BI", ["power bi", "powerbi", "power-bi"]),
    ("Excel", ["excel", "ms excel", "microsoft excel", "advanced excel"]),
    ("Statistical Analysis", ["statistical analysis", "statistics", "statistical modeling"]),
    ("Hypothesis Testing", ["hypothesis testing", "ab testing", "a/b testing", "t-test", "anova"]),
    ("Regression Analysis", ["regression", "linear regression", "logistic regression", "multiple regression"]),
    ("Predictive Modeling", ["predictive modeling", "predictive analytics"]),
    ("Time Series Analysis", ["time series", "time series analysis", "arima"]),
    ("AWS", ["aws", "amazon web services", "amazon aws"]),
    ("Azure", ["azure", "microsoft azure"]),
    ("GCP", ["gcp", "google cloud", "google cloud platform"]),
    ("Cloud Computing", ["cloud computing", "cloud", "cloud platform"]),
    ("Docker", ["docker", "containerization", "containers"]),
    ("Kubernetes", ["kubernetes", "k8s"]),
    ("Spark", ["spark", "apache spark", "pyspark"]),
    ("Hadoop", ["hadoop", "hdfs", "mapreduce"]),
    ("ETL", ["etl", "elt", "data pipeline", "data pipelines"]),
    ("Airflow", ["airflow", "apache airflow"]),
    ("SAP", ["sap", "sap hana", "s/4hana"]),
    ("Salesforce", ["salesforce", "salesforce crm"]),
    ("CRM", ["crm", "customer relationship management"]),
    ("Data Modeling", ["data modeling", "data modelling", "er modeling", "dimensional modeling"]),
    ("Data Warehousing", ["data warehouse", "data warehousing", "data mart"]),
    ("NoSQL", ["nosql", "mongodb", "cassandra", "dynamodb"]),
    ("Financial Modeling", ["financial modeling", "financial model", "dcf", "valuation modeling"]),
    ("Supply Chain Management", ["supply chain", "supply chain management", "scm"]),
    ("Project Management", ["project management", "pmp", "agile", "scrum", "kanban"]),
    ("Communication", ["communication", "verbal communication", "written communication", "presentation"]),
    ("Problem-solving", ["problem-solving", "problem solving", "analytical thinking", "critical thinking"]),
    ("Leadership", ["leadership", "team leadership", "people management"]),
    ("Stakeholder Management", ["stakeholder management", "stakeholder engagement"]),
    ("Data-driven Decision Making", ["data-driven", "data driven", "data-driven decision making"]),
    ("Collaboration", ["collaboration", "teamwork", "cross-functional"]),
    ("Attention to Detail", ["attention to detail", "detail-oriented"]),
]


def _normalize_raw(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


_ALIAS_MAP: dict[str, str] = {}
for canonical, synonyms in SYNONYM_GROUPS:
    for syn in synonyms:
        _ALIAS_MAP[_normalize_raw(syn)] = canonical


#
# Extra phrase-level aliases to handle common course/resume wording that does not
# exactly match the canonical skill strings used in `backend/data/skills.json`.
#
# Note: normalize_skill_list is the canonical normalizer used by the transcript-only
# path, so these mappings are implemented there (normalize_skill() is still used
# for single-skill cases elsewhere).
#
_MULTI_SKILL_ALIASES: dict[str, list[str]] = {
    # SQL / data querying
    "sql": ["SQL", "SQL and scripting languages"],
    "structured query language": ["SQL", "SQL and scripting languages"],
    "database design": ["SQL and scripting languages", "Data modeling"],
    "database schema design": ["Data architecture design"],
    "entity relationship modeling er modeling": ["Data modeling"],
    "er modeling": ["Data modeling"],

    # Data warehousing / analytics
    "data warehousing concepts": ["Data warehousing"],
    "data warehousing": ["Data warehousing"],
    "data warehouse design": ["Data architecture design"],
    "data warehouse architecture": ["Data architecture design"],

    # Machine learning (covers multiple templates)
    "machine learning fundamentals": ["Machine learning fundamentals", "Machine learning algorithms"],
    "machine learning": ["Machine learning fundamentals", "Machine learning algorithms"],
    "machine learning algorithms": ["Machine learning algorithms"],
    "ml": ["Machine learning fundamentals", "Machine learning algorithms"],

    # Cloud
    "cloud computing": ["Cloud platforms (AWS, GCP, Azure)", "AWS", "GCP"],
    "cloud platform": ["Cloud platforms (AWS, GCP, Azure)"],
    "aws": ["Cloud platforms (AWS, GCP, Azure)", "AWS"],
    "gcp": ["Cloud platforms (AWS, GCP, Azure)", "GCP"],
    "azure": ["Cloud platforms (AWS, GCP, Azure)", "Azure"],

    # Data engineering tooling
    "kafka": ["Kafka streaming"],
    "kafka streaming": ["Kafka streaming"],
    "dbt": ["dbt (data build tool)"],
    "data build tool": ["dbt (data build tool)"],
    "etl": ["ETL processes"],
    "elt": ["ETL processes"],
    "extract transform load etl": ["ETL processes"],
    "airflow": ["Data pipeline orchestration (Airflow)"],
    "apache airflow": ["Data pipeline orchestration (Airflow)"],
    "spark": ["Apache Spark / Hadoop"],
    "apache spark": ["Apache Spark / Hadoop"],
    "pyspark": ["Apache Spark / Hadoop"],
    "hadoop": ["Apache Spark / Hadoop"],
    "big data": ["Big data processing", "Big data technologies"],
    "big data processing": ["Big data processing"],

    # Common database systems
    "database management systems": ["Database management systems"],
    "snowflake": ["Database management systems"],
    "redshift": ["Database management systems"],
    "postgresql": ["Database management systems"],
    "mysql": ["Database management systems"],
    "microsoft sql server": ["Database management systems"],
    "sql server": ["Database management systems"],
    "oracle": ["Database management systems"],
}


def normalize_skill(raw: str) -> str:
    return _ALIAS_MAP.get(_normalize_raw(raw), raw.strip())


def normalize_skill_list(skills: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for s in skills:
        norm = _normalize_raw(s)

        mapped: list[str] = []
        if norm in _MULTI_SKILL_ALIASES:
            mapped.extend(_MULTI_SKILL_ALIASES[norm])
        else:
            canon = _ALIAS_MAP.get(norm)
            if canon:
                mapped.append(canon)
            else:
                mapped.append(s.strip())

        # Keyword-based expansions for messy course catalog phrasing.
        # These help map strings like "extract transform load (etl)" -> ETL processes.
        if "etl" in norm or "extract transform load" in norm:
            mapped.append("ETL processes")
        if "airflow" in norm:
            mapped.append("Data pipeline orchestration (Airflow)")
        if "kafka" in norm:
            mapped.append("Kafka streaming")
        if "dbt" in norm or "data build tool" in norm:
            mapped.append("dbt (data build tool)")
        if "spark" in norm or "hadoop" in norm:
            mapped.append("Apache Spark / Hadoop")
        if (
            "cloud computing" in norm
            or "aws" in norm
            or "gcp" in norm
            or "azure" in norm
        ):
            mapped.append("Cloud platforms (AWS, GCP, Azure)")
        if (
            "snowflake" in norm
            or "redshift" in norm
            or "postgresql" in norm
            or "mysql" in norm
            or "sql server" in norm
            or "oracle" in norm
        ):
            mapped.append("Database management systems")
        if "data warehousing" in norm:
            mapped.append("Data warehousing")
        if "machine learning" in norm:
            mapped.append("Machine learning fundamentals")
            mapped.append("Machine learning algorithms")
        if "database design" in norm:
            mapped.append("SQL and scripting languages")
            mapped.append("Data modeling")

        for canon in mapped:
            canon_str = canon.strip()
            if canon_str and canon_str not in seen:
                seen.add(canon_str)
                out.append(canon_str)
    return out
