"""PostgreSQL data layer for AeroGuard — risk & compliance platform.

Replaces the previous MongoDB (pymongo) backing store with SQLAlchemy + Postgres.
Set DATABASE_URL, e.g.:
    postgresql+psycopg2://tprm:tprm@localhost:5432/tprm_db
"""
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    create_engine, Integer, String, Boolean, DateTime, Text, JSON, inspect, text
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column, sessionmaker
)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://tprm:tprm@localhost:5432/tprm_db",
)

# Use Postgres JSONB when on Postgres; fall back to generic JSON (e.g. SQLite for
# local one-click dev) so the same models run on either backend.
JSONType = JSON().with_variant(JSONB(), "postgresql")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")
    company_name: Mapped[str] = mapped_column(String(255), default="")
    mobile: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # optional phone
    role: Mapped[str] = mapped_column(String(50), default="vendor")  # admin | internal_auditor | vendor
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    is_mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_first_login: Mapped[bool] = mapped_column(Boolean, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    tprm_status: Mapped[str] = mapped_column(String(50), default="Not yet started")
    vendor_score: Mapped[int] = mapped_column(Integer, default=0)
    submitted_answers: Mapped[dict] = mapped_column(JSONType, default=dict)

    # --- Vendor workflow ---
    assigned_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # auditor email who triggered
    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # when triggered
    assigned_questions: Mapped[Optional[list]] = mapped_column(JSONType, nullable=True)  # curated question_id list
    vendor_details: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)  # vendor profile for the report
    certifications: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)  # security certs declared by vendor
    cert_override: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=False)  # admin forced questionnaire
    draft_answers: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)  # autosaved in-progress responses
    evidence_files: Mapped[Optional[list]] = mapped_column(JSONType, nullable=True)  # uploaded evidence filenames

    # --- AI layer output (populated by ai.generate_risk_assessment) ---
    ai_risk_summary: Mapped[Optional[dict]] = mapped_column(JSONType, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    question_id: Mapped[str] = mapped_column(String(50), index=True)  # e.g. "Q_1"
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(255), default="General Security")
    reference_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # answer-key response text
    reference_choice: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # Yes | No | NA
    ai_suggested: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, default=False)  # AI-generated answer


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), default="")


class SocControl(Base):
    __tablename__ = "soc_controls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    control_id: Mapped[str] = mapped_column(String(50), index=True)  # CTRL_1
    domain: Mapped[str] = mapped_column(String(255), default="General")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    mapped_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # stakeholder email
    # stakeholder response
    status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # Implemented/Partial/Not Implemented/NA
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[Optional[list]] = mapped_column(JSONType, nullable=True)
    submitted: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    # auditor review
    review_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)  # pass/fail/return
    review_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


def init_db() -> None:
    """Create tables if they do not yet exist, then add any newly-introduced columns."""
    Base.metadata.create_all(bind=engine)
    _ensure_columns()


def _ensure_columns() -> None:
    """Lightweight migration: ADD COLUMN for any columns missing on existing tables
    (so old SQLite/Postgres databases pick up new fields)."""
    json_sql = "JSONB" if engine.dialect.name == "postgresql" else "JSON"
    specs = {
        "users": {
            "mobile": "VARCHAR(30)",
            "assigned_by": "VARCHAR(255)",
            "assigned_at": "TIMESTAMP",
            "assigned_questions": json_sql,
            "vendor_details": json_sql,
            "certifications": json_sql,
            "cert_override": "BOOLEAN",
            "draft_answers": json_sql,
            "evidence_files": json_sql,
            "ai_risk_summary": json_sql,
        },
        "questions": {
            "reference_answer": "TEXT",
            "reference_choice": "VARCHAR(10)",
            "ai_suggested": "BOOLEAN",
        },
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, cols in specs.items():
            existing = {c["name"] for c in inspector.get_columns(table)}
            for col, sqltype in cols.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {sqltype}"))
