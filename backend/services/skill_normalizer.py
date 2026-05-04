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


def normalize_skill(raw: str) -> str:
    return _ALIAS_MAP.get(_normalize_raw(raw), raw.strip())


def normalize_skill_list(skills: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for s in skills:
        canon = normalize_skill(s)
        if canon not in seen:
            seen.add(canon)
            out.append(canon)
    return out
