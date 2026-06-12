from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
import io
import os
import json
import uuid
import time
import secrets
from datetime import datetime, timezone
from collections import defaultdict, deque
import pandas as pd
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from db import SessionLocal, init_db, User, Question, Notification, Setting, SocControl
from models import (
    LoginRequest, VerifyMFARequest, CreateUserRequest, CreateVendorRequest, AddQuestionRequest, HelpRequest,
    RequestOTPRequest, ForgotPasswordRequest, SecureChangePasswordRequest
)
from auth import hash_password, verify_password, create_jwt_token
import ai
import notify

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


from pydantic import field_validator


class ForcePasswordResetRequest(BaseModel):
    email: EmailStr
    newPassword: str

    @field_validator("newPassword")
    @classmethod
    def _strong(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 8 or len(v) > 128:
            raise ValueError("Password must be 8-128 characters.")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain letters and numbers.")
        return v


app = FastAPI(title="AeroGuard — Risk & Compliance Platform")

# ── Security config (override via env in production) ──
FRONTEND_ORIGINS = [o.strip() for o in os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",") if o.strip()]
ALLOWED_HOSTS = [h.strip() for h in os.getenv(
    "ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0,testserver"
).split(",") if h.strip()]
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(30 * 1024 * 1024)))   # 30 MB
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))  # 15 MB per file

# Block spoofed Host headers
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

# CORS — restricted to the known frontend origins (no wildcard + credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,
)


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # Reject oversized requests early (DoS protection)
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Request body too large."})
    response = await call_next(request)
    # Hardening response headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Cache-Control"] = "no-store"
    return response


# ── Simple in-memory rate limiter (brute-force / abuse protection) ──
_RATE_BUCKETS = defaultdict(deque)


def rate_limit(request: Request, bucket: str, limit: int = 10, window: int = 60):
    ip = request.client.host if request.client else "unknown"
    key = f"{bucket}:{ip}"
    now = time.time()
    dq = _RATE_BUCKETS[key]
    while dq and dq[0] < now - window:
        dq.popleft()
    if len(dq) >= limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a minute and try again.")
    dq.append(now)


def _validate_xlsx(file: UploadFile) -> bytes:
    """Validate an uploaded spreadsheet: extension + size. Returns the bytes."""
    name = (file.filename or "").lower()
    if not (name.endswith(".xlsx") or name.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx / .xls files are accepted.")
    data = file.file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB).")
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    return data


# ── OTP store (in-memory, 5-minute TTL) for password reset/change ──
_OTP_STORE = {}
_OTP_TTL = 300


def _gen_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def _issue_otps(email: str) -> dict:
    """Issue DISTINCT OTPs for the mail and mobile channels."""
    mail_otp = _gen_otp()
    mobile_otp = _gen_otp()
    while mobile_otp == mail_otp:
        mobile_otp = _gen_otp()
    now = time.time()
    _OTP_STORE[f"{email}:mail"] = {"otp": mail_otp, "exp": now + _OTP_TTL}
    _OTP_STORE[f"{email}:mobile"] = {"otp": mobile_otp, "exp": now + _OTP_TTL}
    return {"mail": mail_otp, "mobile": mobile_otp}


def _verify_otp(email: str, channel: str, otp: str) -> bool:
    rec = _OTP_STORE.get(f"{email}:{channel}")
    if not rec or time.time() > rec["exp"]:
        _OTP_STORE.pop(f"{email}:{channel}", None)
        return False
    if rec["otp"] != str(otp).strip():
        return False
    _OTP_STORE.pop(f"{email}:{channel}", None)  # one-time use
    return True


# ─── DB SESSION DEPENDENCY ───
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def seed_admin_node():
    """Create tables and ensure a system admin exists on launch."""
    init_db()
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == "admin@aeroguard.com"))
        if not existing:
            db.add(User(
                email="admin@aeroguard.com",
                name="AeroGuard IS Admin",
                company_name="AeroGuard Internal",
                role="admin",
                password_hash=hash_password("AeroGuard@123"),
                is_mfa_enabled=False,
                is_first_login=False,
                is_locked=False,
                tprm_status="Verified",
            ))
            db.commit()
    finally:
        db.close()
    # Phase 2: start the SOC 2 evidence-reminder scheduler (in-process APScheduler)
    try:
        import soc_reminders
        soc_reminders.start_scheduler()
    except Exception as exc:  # noqa: BLE001 — never block startup
        print(f"[soc] reminder scheduler not started: {exc}")


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "login", limit=8, window=60)
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user:
        raise HTTPException(status_code=404, detail="Identity mapping missing.")
    if not verify_password(payload.password, user.password_hash) and user.password_hash != payload.password:
        raise HTTPException(status_code=401, detail="Invalid credential combination validation failure.")
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    return {"status": "mfa_required", "mfaRequired": True, "email": user.email}


@app.post("/api/auth/verify-mfa")
def verify_mfa(payload: VerifyMFARequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "mfa", limit=10, window=60)
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user:
        raise HTTPException(status_code=404, detail="Identity profile dropped.")
    if user.is_locked:
        raise HTTPException(status_code=403, detail="Account suspended. Contact an administrator.")
    token = create_jwt_token(str(user.id), user.role)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name or "Operator Account",
            "role": user.role,
            "isFirstLogin": user.is_first_login,
        },
    }


@app.post("/api/auth/change-password")
def change_password(payload: ForcePasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "change-pw", limit=10, window=60)
    target_email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == target_email))
    if not user:
        raise HTTPException(status_code=404, detail="User account could not be found to update password.")

    user.password_hash = hash_password(payload.newPassword)
    user.is_first_login = False
    db.commit()

    return {
        "message": "Credentials updated successfully.",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name or "User Account",
            "role": user.role,
            "isFirstLogin": False,
        },
    }


# ─── OTP-based password reset / change ───
@app.post("/api/auth/request-otp")
def request_otp(payload: RequestOTPRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "otp-req", limit=5, window=120)
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    otps = _issue_otps(user.email)
    # Deliver: email (best-effort) + log both (mobile has no real SMS gateway here)
    body = (f"Your verification codes:\n  • Email OTP: {otps['mail']}\n"
            f"  • Mobile OTP ({user.mobile or 'no mobile on file'}): {otps['mobile']}\n"
            f"Valid for 5 minutes. Mail and mobile codes are different.")
    try:
        notify._log_fallback("OTP verification", [user.email], body, reason="OTP issued")
    except Exception:
        pass
    smtp_configured = bool(os.getenv("SMTP_HOST"))
    resp = {
        "message": "OTPs sent to your registered email and mobile.",
        "hasMobile": bool(user.mobile),
    }
    if not smtp_configured:
        # Dev convenience: no SMTP/SMS gateway configured — surface codes so the flow is testable.
        resp["devOtps"] = otps
    return resp


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "forgot", limit=10, window=300)
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    if payload.mailOtp.strip() == payload.mobileOtp.strip():
        raise HTTPException(status_code=400, detail="Email and mobile OTPs must be different.")
    # Optional: if the user chose the "with current password" route, verify it.
    if payload.oldPassword:
        if not verify_password(payload.oldPassword, user.password_hash) and user.password_hash != payload.oldPassword:
            raise HTTPException(status_code=401, detail="Current password is incorrect.")
    if not _verify_otp(user.email, "mail", payload.mailOtp):
        raise HTTPException(status_code=400, detail="Invalid or expired email OTP.")
    if not _verify_otp(user.email, "mobile", payload.mobileOtp):
        raise HTTPException(status_code=400, detail="Invalid or expired mobile OTP.")
    user.password_hash = hash_password(payload.newPassword)
    user.is_first_login = False
    user.is_locked = False
    db.commit()
    return {"message": "Password reset successfully. You can now sign in."}


@app.post("/api/auth/change-password-secure")
def change_password_secure(payload: SecureChangePasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limit(request, "change-secure", limit=10, window=300)
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    # Must know the current password
    if not verify_password(payload.oldPassword, user.password_hash) and user.password_hash != payload.oldPassword:
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    # And an OTP from EITHER channel
    if not (_verify_otp(user.email, "mail", payload.otp) or _verify_otp(user.email, "mobile", payload.otp)):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")
    user.password_hash = hash_password(payload.newPassword)
    user.is_first_login = False
    db.commit()
    return {"message": "Password changed successfully."}


@app.post("/api/admin/users/")
def create_internal_user(payload: CreateUserRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=400, detail="Identity profile already registered.")
    new_user = User(
        email=email,
        name=payload.name,
        company_name=payload.companyName,
        mobile=(payload.mobile or "").strip() or None,
        role=payload.role,
        password_hash=hash_password("AeroGuard@123"),
        is_first_login=True,
        is_mfa_enabled=True,
        is_locked=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User provisioned successfully.", "id": new_user.id}


@app.get("/api/admin/users/")
def list_internal_users(db: Session = Depends(get_db)):
    users = db.scalars(
        select(User).where(User.role.in_(["admin", "internal_auditor"])).order_by(User.id)
    ).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "mobile": u.mobile or "",
         "role": u.role, "isSuspended": u.is_locked}
        for u in users
    ]


@app.delete("/api/admin/users/{user_id}")
def delete_internal_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.email == "admin@aeroguard.com":
        raise HTTPException(status_code=400, detail="The primary system admin cannot be deleted.")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully."}


@app.post("/api/admin/users/{user_id}/suspend")
def set_user_suspended(user_id: int, suspended: bool = True, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if suspended and user.email == "admin@aeroguard.com":
        raise HTTPException(status_code=400, detail="The primary system admin cannot be suspended.")
    user.is_locked = suspended
    db.commit()
    state = "suspended" if suspended else "reactivated"
    return {"message": f"User {state} successfully.", "isSuspended": user.is_locked}


@app.post("/api/admin/upload-vendors-xlsx")
def bulk_upload_vendors(file: UploadFile = File(...), db: Session = Depends(get_db)):
    df = pd.read_excel(io.BytesIO(_validate_xlsx(file)))
    for _, row in df.iterrows():
        email = str(row.get("Email", "")).strip().lower()
        name = str(row.get("Company Name", "")).strip()
        if email and not db.scalar(select(User).where(User.email == email)):
            db.add(User(
                email=email, company_name=name, name=name, role="vendor",
                password_hash=hash_password("AeroGuard@123"), is_first_login=False,
                tprm_status="Not yet started", vendor_score=0, submitted_answers={},
            ))
    db.commit()
    return {"message": "Vendor directory synced mapping successfully updated."}


def _next_question_n(existing) -> int:
    nums = [int(q.question_id.split("_")[-1]) for q in existing
            if q.question_id.startswith("Q_") and q.question_id.split("_")[-1].isdigit()]
    return 1 + max(nums + [0])


# Recognised header variants (case/space-insensitive)
_Q_HEADERS = ["question text", "question", "questions", "question description",
              "control question", "control", "requirement", "query"]
_D_HEADERS = ["domain", "category", "control domain", "section", "area", "control area"]
_A_HEADERS = ["reference answer", "expected answer", "ideal answer",
              "model answer", "sample answer", "response", "remarks", "details", "answer"]
_C_HEADERS = ["yes/no/na", "yes/no/n/a", "yes/no", "yes / no / na", "yes / no",
              "compliance", "compliant", "status", "yes no na", "answer (yes/no)"]


def _find_col(columns, candidates):
    norm = {str(c).strip().lower(): c for c in columns}
    for cand in candidates:
        if cand in norm:
            return norm[cand]
    return None


def _cell(row, col, default=""):
    if col is None:
        return default
    val = str(row.get(col, default)).strip()
    return default if val.lower() == "nan" else val


import re as _re

_NOISE_LABELS = {"high", "medium", "low", "yes", "no", "s.no", "sno", "sr no",
                 "general security", "remarks", "status", "evidence"}


def _is_meaningful_question(text: str) -> bool:
    """Filter out obvious non-questions pulled in from messy spreadsheets:
    bare numbers, enumeration markers, single-word labels, section headers."""
    t = (text or "").strip()
    if not t:
        return False
    if _re.fullmatch(r"[\d\.\)\(\s,:–—-]+", t):          # pure numbers / numbering
        return False
    if _re.fullmatch(r"[A-Za-z][\)\.]|S\.?No\.?|[ivxlIVXL]+[\)\.]", t):  # a) b) iv) S.No
        return False
    if t.lower() in _NOISE_LABELS:
        return False
    words = _re.findall(r"[A-Za-z]{2,}", t)
    if len(words) < 3 and "?" not in t:                 # too short and not a question
        return False
    return True


# Header keyword sets for the raw-row parser (handles merged domain headers +
# 'S.No | Assessment Questions | Vendor Response | Vendor Remarks' layout, AND the
# flat 'Question Text | Domain | Answer' layout).
_HQ = ["assessment questions", "assessment question", "question text", "question",
       "control question", "control", "requirement", "query"]
_HC = ["vendor response", "yes/no/na", "yes/no/n/a", "yes/no", "compliance",
       "compliant", "status", "response (yes/no)"]
_HA = ["vendor remarks", "remarks", "reference answer", "expected answer",
       "ideal answer", "comments", "details", "answer"]
_HD = ["domain", "category", "section", "control area", "area"]


def _hidx(low_cells, candidates, exclude=()):
    """Index of the column whose header matches a candidate (exact first, then
    substring), skipping excluded indices."""
    for j, c in enumerate(low_cells):
        if j not in exclude and c in candidates:
            return j
    for j, c in enumerate(low_cells):
        if j not in exclude and any(h in c for h in candidates):
            return j
    return None


def _is_header_row(low_cells) -> bool:
    joined = " ".join(low_cells)
    if "assessment question" in joined or "question text" in joined:
        return True
    return _hidx(low_cells, _HQ) is not None and _hidx(low_cells, _HC) is not None


def _extract_rows(data: bytes):
    """Parse EVERY worksheet into a flat list of dicts:
    {sheet, domain, question, choice, remarks}. Handles merged domain-header rows
    (single-cell section titles) and repeated column-header rows."""
    try:
        sheets = pd.read_excel(io.BytesIO(data), sheet_name=None, header=None)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read the .xlsx file: {exc}")

    out = []
    for name, df in sheets.items():
        raw = []
        for _, r in df.iterrows():
            cells = ["" if pd.isna(v) else str(v).strip() for v in r.tolist()]
            if any(cells):
                raw.append(cells)
        if not raw:
            continue

        # Locate the column-header row and map columns.
        cmap, hdr_idx = None, None
        for i, row in enumerate(raw):
            low = [c.lower() for c in row]
            if _is_header_row(low):
                qj = _hidx(low, _HQ)
                cj = _hidx(low, _HC, exclude={qj} if qj is not None else set())
                ex = {x for x in (qj, cj) if x is not None}
                aj = _hidx(low, _HA, exclude=ex)
                dj = _hidx(low, _HD, exclude=ex | ({aj} if aj is not None else set()))
                cmap, hdr_idx = {"q": qj, "c": cj, "a": aj, "d": dj}, i
                break

        current_domain = name  # fall back to the sheet name
        for i, row in enumerate(raw):
            if i == hdr_idx:
                continue
            nonempty = [c for c in row if c]
            # Merged domain/section header → exactly one non-empty, non-numeric cell.
            if len(nonempty) == 1 and not _re.fullmatch(r"[\d\.\)\(\s,:–—-]+", nonempty[0]) \
                    and not _is_header_row([nonempty[0].lower()]):
                current_domain = nonempty[0]
                continue
            if cmap and cmap["q"] is not None:
                q = row[cmap["q"]] if cmap["q"] < len(row) else ""
                choice = row[cmap["c"]] if cmap["c"] is not None and cmap["c"] < len(row) else ""
                remarks = row[cmap["a"]] if cmap["a"] is not None and cmap["a"] < len(row) else ""
                dom = (row[cmap["d"]] if cmap["d"] is not None and cmap["d"] < len(row) else "") or current_domain
            else:
                q, choice, remarks, dom = (row[0] if row else ""), "", "", current_domain
            if not q or not _is_meaningful_question(q):
                continue
            if "assessment question" in q.lower() or "question text" in q.lower():
                continue
            out.append({"sheet": name, "domain": (dom or "General Security").strip(),
                        "question": q.strip(), "choice": choice.strip(), "remarks": remarks.strip()})
    return out


@app.post("/api/admin/upload-questions-xlsx")
def bulk_upload_questions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Additive upload — reads ALL worksheets, appends new questions and uses AI to
    filter out duplicates (against the bank and across sheets). Column headers are
    detected flexibly per sheet; if none obvious, the first column is used."""
    rows = _extract_rows(_validate_xlsx(file))
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No questions found. Expected a question column (e.g. 'Assessment Questions' "
                   "or 'Question Text'); domains may be merged section headers.",
        )

    existing = db.scalars(select(Question)).all()
    accepted_texts = [q.question_text for q in existing]
    next_n = _next_question_n(existing)
    sheets_seen = {r["sheet"] for r in rows}

    added, skipped = 0, 0
    for r in rows:
        text = r["question"]
        domain = r["domain"] or "General Security"
        ref_choice = ai.normalize_choice(r["choice"])
        ref_resp = r["remarks"]
        # If no Yes/No/NA in the choice column but the remarks cell IS Yes/No/NA, use it.
        if not ref_choice:
            maybe = ai.normalize_choice(ref_resp)
            if maybe:
                ref_choice, ref_resp = maybe, ""
        if ai.is_duplicate_question(text, accepted_texts):
            skipped += 1
            continue
        db.add(Question(question_id=f"Q_{next_n}", question_text=text, domain=domain,
                        reference_answer=ref_resp or None, reference_choice=ref_choice or None))
        accepted_texts.append(text)
        next_n += 1
        added += 1
    db.commit()
    return {
        "message": f"Added {added} new question(s); {skipped} duplicate(s) filtered by AI "
                   f"across {len(sheets_seen)} sheet(s).",
        "added": added, "skipped": skipped, "total": len(accepted_texts), "sheets": len(sheets_seen),
    }


@app.post("/api/admin/questions/clean-noise")
def clean_noise_questions(db: Session = Depends(get_db)):
    """Remove rows that are not actual questions (bare numbers, headers, markers)."""
    questions = db.scalars(select(Question)).all()
    removed = 0
    for q in questions:
        if not _is_meaningful_question(q.question_text):
            db.delete(q)
            removed += 1
    db.commit()
    return {"message": f"Removed {removed} non-question row(s). {len(questions) - removed} question(s) remain.",
            "removed": removed, "remaining": len(questions) - removed}


@app.post("/api/admin/questions/categorize")
def categorize_questions(db: Session = Depends(get_db)):
    """Re-categorize every question into a standard Information Security domain
    using AI sense (keyword classification)."""
    questions = db.scalars(select(Question)).all()
    breakdown = {}
    for q in questions:
        q.domain = ai.categorize_question(q.question_text)
        breakdown[q.domain] = breakdown.get(q.domain, 0) + 1
    db.commit()
    return {"message": f"Categorized {len(questions)} question(s) into {len(breakdown)} InfoSec domain(s).",
            "breakdown": breakdown}


@app.delete("/api/admin/questions")
def clear_all_questions(db: Session = Depends(get_db)):
    """Wipe the question bank and reset every vendor's questionnaire state."""
    db.query(Question).delete()
    for v in db.scalars(select(User).where(User.role == "vendor")).all():
        v.submitted_answers = {}
        v.draft_answers = None
        v.evidence_files = None
        v.vendor_score = 0
        v.tprm_status = "Not yet started"
        v.ai_risk_summary = None
        v.assigned_by = None
    db.commit()
    return {"message": "All questions cleared and vendor questionnaires reset."}


@app.post("/api/auditor/fill-seller-audit")
def fill_seller_audit(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Auditor uploads a questionnaire (questions only); we auto-fill each question's
    response from the admin-loaded answer bank using AI matching."""
    rows = _extract_rows(_validate_xlsx(file))
    if not rows:
        raise HTTPException(status_code=400, detail="No questions found in the uploaded workbook.")
    bank = [
        {"text": q.question_text, "answer": q.reference_answer or "",
         "choice": q.reference_choice or "", "domain": q.domain}
        for q in db.scalars(select(Question)).all()
    ]
    results = []
    for r in rows:
        match, score = ai.best_answer_match(r["question"], bank)
        results.append({
            "sheet": r["sheet"],
            "question": r["question"],
            "matchedQuestion": match["text"] if match else None,
            "choice": match["choice"] if match else "",
            "answer": match["answer"] if match else "",
            "confidence": round(score, 2),
        })
    filled = sum(1 for r in results if r["answer"] or r["choice"])
    return {"count": len(results), "filled": filled, "results": results}


@app.post("/api/admin/vendors")
def create_vendor(payload: CreateVendorRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=400, detail="A vendor with this email is already registered.")
    vendor = User(
        email=email,
        company_name=payload.companyName,
        name=payload.companyName,
        role="vendor",
        password_hash=hash_password("AeroGuard@123"),
        is_first_login=False,
        tprm_status="Not yet started",
        vendor_score=0,
        submitted_answers={},
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return {"message": "Vendor added successfully.", "id": vendor.id}


@app.get("/api/admin/auditor-activity")
def auditor_activity(db: Session = Depends(get_db)):
    """Dashboard: which auditor is handling which vendor, status, and when triggered."""
    auditors = {a.email: a for a in db.scalars(select(User).where(User.role == "internal_auditor")).all()}
    rows = []
    open_states = ("Triggered", "Under Audit Review", "Action Required")
    for v in db.scalars(select(User).where(User.role == "vendor", User.assigned_by.isnot(None))).all():
        a = auditors.get(v.assigned_by)
        rows.append({
            "auditorName": a.name if a else "",
            "auditorEmail": v.assigned_by,
            "vendor": v.company_name or v.name or v.email,
            "vendorEmail": v.email,
            "status": v.tprm_status,
            "active": v.tprm_status in open_states,
            "assignedAt": v.assigned_at.isoformat() if v.assigned_at else None,
        })
    rows.sort(key=lambda r: (r["assignedAt"] or ""), reverse=True)
    busy = sorted({r["auditorEmail"] for r in rows if r["active"]})
    return {"activity": rows, "busyAuditors": len(busy), "totalAssignments": len(rows)}


@app.get("/api/admin/vendors")
def get_vendors_list(db: Session = Depends(get_db)):
    vendors = db.scalars(select(User).where(User.role == "vendor")).all()
    return [{
        "id": v.id, "email": v.email, "companyName": v.company_name or v.name,
        "tprmStatus": v.tprm_status, "vendorScore": v.vendor_score,
        "assignedBy": v.assigned_by,
        "aiRiskSummary": v.ai_risk_summary,
        "isSuspended": v.is_locked,
    } for v in vendors]


@app.get("/api/questions")
def read_framework_questions(db: Session = Depends(get_db)):
    # Vendor-safe: questions only, NO reference answers.
    questions = db.scalars(select(Question)).all()
    return [{"id": q.question_id, "text": q.question_text, "domain": q.domain} for q in questions]


@app.get("/api/admin/questions-detail")
def read_questions_detail(db: Session = Depends(get_db)):
    # Admin/auditor view: includes the answer-key (Yes/No/NA choice + response text).
    questions = db.scalars(select(Question)).all()
    return [{"id": q.question_id, "text": q.question_text, "domain": q.domain,
             "referenceChoice": q.reference_choice or "",
             "referenceAnswer": q.reference_answer or "",
             "aiSuggested": bool(q.ai_suggested)} for q in questions]


# ─── Freeze flag (Setting key/value) ───
def _is_frozen(db: Session) -> bool:
    s = db.get(Setting, "questions_frozen")
    return bool(s and s.value == "1")


@app.get("/api/admin/questions/freeze-status")
def freeze_status(db: Session = Depends(get_db)):
    return {"frozen": _is_frozen(db)}


@app.post("/api/admin/questions/freeze")
def set_freeze(frozen: bool = Form(...), role: str = Form(""), db: Session = Depends(get_db)):
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only an admin can freeze/unfreeze the question bank.")
    s = db.get(Setting, "questions_frozen")
    if not s:
        s = Setting(key="questions_frozen", value="0")
        db.add(s)
    s.value = "1" if frozen else "0"
    db.commit()
    return {"frozen": frozen}


# ─── Edit a question's answer-key (admin always; auditor only if not frozen) ───
@app.post("/api/admin/questions/{qid}/edit")
def edit_question(
    qid: str, role: str = Form(""), choice: str = Form(""), response: str = Form(""),
    text: str = Form(""), domain: str = Form(""), db: Session = Depends(get_db),
):
    if _is_frozen(db) and role != "admin":
        raise HTTPException(status_code=403, detail="The question bank is frozen. Only an admin can edit it.")
    q = db.scalar(select(Question).where(Question.question_id == qid))
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    if text.strip():
        q.question_text = text.strip()
    if domain.strip():
        q.domain = domain.strip()
    q.reference_choice = ai.normalize_choice(choice) or None
    q.reference_answer = response.strip() or None
    q.ai_suggested = False  # human-reviewed/edited
    db.commit()
    return {"message": "Question updated."}


@app.delete("/api/admin/questions/{qid}")
def delete_question(qid: str, role: str = "", db: Session = Depends(get_db)):
    if _is_frozen(db) and role != "admin":
        raise HTTPException(status_code=403, detail="The question bank is frozen. Only an admin can delete questions.")
    q = db.scalar(select(Question).where(Question.question_id == qid))
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    db.delete(q)
    db.commit()
    return {"message": "Question deleted."}


# ─── AI: answer unanswered questions from the already-answered ones ───
@app.post("/api/admin/questions/ai-answer")
def ai_answer_questions(db: Session = Depends(get_db)):
    questions = db.scalars(select(Question)).all()
    answered = [q for q in questions if (q.reference_answer or q.reference_choice)]
    if not answered:
        raise HTTPException(
            status_code=400,
            detail="No answered questions to learn from. Upload some questions with answers first.",
        )
    bank = [{"text": q.question_text, "answer": q.reference_answer or "",
             "choice": q.reference_choice or ""} for q in answered]
    filled = 0
    for q in questions:
        if q.reference_answer or q.reference_choice:
            continue
        match, score = ai.best_answer_match(q.question_text, bank)
        if match:
            q.reference_choice = (match["choice"] or None)
            q.reference_answer = (match["answer"] or None)
            q.ai_suggested = True
            filled += 1
    db.commit()
    return {"message": f"AI answered {filled} question(s) using {len(answered)} existing answer(s). "
                       f"Review the AI-suggested answers and edit as needed.",
            "filled": filled}


@app.post("/api/admin/questions")
def add_question(payload: AddQuestionRequest, db: Session = Depends(get_db)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Question text is required.")
    # Generate a unique question_id (Q_<n>) based on the current max.
    existing = db.scalars(select(Question)).all()
    next_n = 1 + max([int(q.question_id.split("_")[-1]) for q in existing if q.question_id.startswith("Q_") and q.question_id.split("_")[-1].isdigit()] + [0])
    q = Question(
        question_id=f"Q_{next_n}", question_text=text,
        domain=payload.domain.strip() or "General Security",
        reference_choice=ai.normalize_choice(payload.choice) or None,
        reference_answer=payload.response.strip() or None,
    )
    db.add(q)
    db.commit()
    return {"message": "Question added successfully.", "id": q.question_id}


def _vendor_questions(db: Session, vendor: User):
    """Questions assigned to a vendor (curated subset at trigger time), else all."""
    all_q = db.scalars(select(Question)).all()
    assigned = vendor.assigned_questions
    if assigned:
        aset = set(assigned)
        return [q for q in all_q if q.question_id in aset]
    return all_q


# ─── AUDITOR: trigger questionnaire to a vendor (optionally a curated subset) ───
@app.post("/api/auditor/trigger")
def trigger_questionnaire(
    vendorId: str = Form(...), triggeredBy: str = Form(...),
    questionIds: str = Form(""), db: Session = Depends(get_db),
):
    vendor = db.get(User, int(vendorId))
    if not vendor or vendor.role != "vendor":
        raise HTTPException(status_code=404, detail="Vendor not found.")

    all_ids = [q.question_id for q in db.scalars(select(Question)).all()]
    if questionIds.strip():
        chosen = [qid for qid in json.loads(questionIds) if qid in set(all_ids)]
    else:
        chosen = all_ids  # default: send the whole bank
    if not chosen:
        raise HTTPException(status_code=400, detail="Select at least one question to trigger.")

    vendor.assigned_by = triggeredBy.strip().lower()
    vendor.assigned_at = datetime.now(timezone.utc)
    vendor.assigned_questions = chosen
    vendor.cert_override = True  # admin/auditor explicitly wants this vendor assessed
    vendor.tprm_status = "Triggered"
    db.commit()
    return {
        "success": True,
        "message": f"Questionnaire triggered to {vendor.company_name or vendor.email}.",
        "vendor": vendor.company_name or vendor.email,
        "vendorEmail": vendor.email,
        "triggeredBy": triggeredBy.strip().lower(),
        "questionCount": len(chosen),
    }


@app.get("/api/vendor/questions")
def vendor_assigned_questions(email: str, db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return [{"id": q.question_id, "text": q.question_text, "domain": q.domain}
            for q in _vendor_questions(db, vendor)]


# ─── VENDOR: load own questionnaire state (questions + saved draft + status) ───
def _norm_answer(a):
    """Normalize a stored answer to {choice, response} (handles legacy string form)."""
    if isinstance(a, dict):
        return {"choice": a.get("choice", ""), "response": a.get("response", "")}
    return {"choice": "", "response": str(a or "")}


def _tentative_score(db: Session, answers: dict, vendor: User = None) -> int:
    """AI tentative score (0-100) of answers vs. the answer-key (choice + response).
    Scoped to the vendor's assigned questions when a vendor is given."""
    questions = _vendor_questions(db, vendor) if vendor is not None else db.scalars(select(Question)).all()
    items = []
    for q in questions:
        a = _norm_answer(answers.get(q.question_id))
        items.append({"choice": a["choice"], "response": a["response"],
                      "refChoice": q.reference_choice, "refAnswer": q.reference_answer})
    return ai.compute_tentative_score(items)


@app.get("/api/questions/reference")
def get_reference_answers(db: Session = Depends(get_db)):
    """Answer-key used by the SR Seller Audit auto-fill buttons."""
    questions = db.scalars(select(Question)).all()
    return {q.question_id: (q.reference_answer or "") for q in questions}


@app.get("/api/vendor/state")
def vendor_state(email: str, db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    # Auditor who triggered this questionnaire (name, email, mobile if available)
    auditor = None
    if vendor.assigned_by:
        a = db.scalar(select(User).where(User.email == vendor.assigned_by))
        if a:
            auditor = {"name": a.name, "email": a.email, "mobile": a.mobile or ""}
        else:
            auditor = {"name": "", "email": vendor.assigned_by, "mobile": ""}
    certs = vendor.certifications or {}
    exempt = bool(certs.get("iso27001") and certs.get("soc2type2"))
    questionnaire_enabled = bool(vendor.cert_override) or not exempt
    return {
        "tprmStatus": vendor.tprm_status,
        "draftAnswers": vendor.draft_answers or {},
        "submittedAnswers": vendor.submitted_answers or {},
        "evidence": vendor.evidence_files or [],
        "assignedBy": vendor.assigned_by,
        "auditor": auditor,
        "vendorScore": vendor.vendor_score or 0,
        "certifications": certs,
        "certExempt": exempt,
        "certOverride": bool(vendor.cert_override),
        "questionnaireEnabled": questionnaire_enabled,
    }


@app.get("/api/vendor/certifications")
def get_certifications(email: str, db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return {"certifications": vendor.certifications or {}}


@app.post("/api/vendor/certifications")
def save_certifications(email: str = Form(...), certifications: str = Form(...), db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    vendor.certifications = json.loads(certifications)
    db.commit()
    certs = vendor.certifications or {}
    exempt = bool(certs.get("iso27001") and certs.get("soc2type2"))
    return {"message": "Certifications saved.", "certExempt": exempt,
            "questionnaireEnabled": bool(vendor.cert_override) or not exempt}


@app.post("/api/vendor/help")
def vendor_help(payload: HelpRequest):
    """AI guidance for a vendor on how to answer a question (no answer-key leakage)."""
    return {"suggestion": ai.generate_help(payload.question, payload.domain)}


# ─── VENDOR: company profile / details (attached to the final report) ───
@app.get("/api/vendor/details")
def get_vendor_details(email: str, db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return {"details": vendor.vendor_details or {}}


@app.post("/api/vendor/details")
def save_vendor_details(email: str = Form(...), details: str = Form(...), db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    vendor.vendor_details = json.loads(details)
    db.commit()
    return {"message": "Vendor details saved."}


# ─── VENDOR: autosave in-progress responses (returns live AI tentative score) ───
@app.post("/api/vendor/save-draft")
def save_draft(email: str = Form(...), answers: str = Form(...), db: Session = Depends(get_db)):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    parsed = json.loads(answers)
    vendor.draft_answers = parsed
    vendor.vendor_score = _tentative_score(db, parsed, vendor)  # tentative score on each save
    db.commit()
    return {"message": "Draft saved.", "score": vendor.vendor_score}


# ─── AUDITOR: "SR Seller Audit" — auto-fill a vendor's questionnaire from the answer-key ───
@app.post("/api/auditor/sr-seller-audit")
def sr_seller_audit(
    vendorId: str = Form(...), auditorEmail: str = Form(""), db: Session = Depends(get_db)
):
    vendor = db.get(User, int(vendorId))
    if not vendor or vendor.role != "vendor":
        raise HTTPException(status_code=404, detail="Vendor not found.")
    questions = db.scalars(select(Question)).all()
    if not questions:
        raise HTTPException(status_code=400, detail="No questionnaire loaded.")
    filled = {q.question_id: (q.reference_answer or "") for q in questions}
    if not any(v.strip() for v in filled.values()):
        raise HTTPException(status_code=400, detail="The questionnaire has no reference answers to audit from.")
    vendor.submitted_answers = filled
    vendor.draft_answers = filled
    if auditorEmail.strip():
        vendor.assigned_by = auditorEmail.strip().lower()
    vendor.vendor_score = _tentative_score(db, filled)
    vendor.tprm_status = "Under Audit Review"
    qa_pairs = [{"text": q.question_text, "domain": q.domain, "answer": filled[q.question_id]} for q in questions]
    vendor.ai_risk_summary = ai.generate_risk_assessment(
        vendor.company_name or vendor.name, vendor.vendor_score, qa_pairs
    )
    db.commit()
    return {"message": f"SR Seller Audit completed for {vendor.company_name or vendor.email}.",
            "score": vendor.vendor_score}


# ─── VENDOR: upload supporting evidence ───
@app.post("/api/vendor/upload-evidence")
def upload_evidence(
    email: str = Form(...), file: UploadFile = File(...),
    questionId: str = Form(""), db: Session = Depends(get_db),
):
    vendor = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    data = file.file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB).")
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    safe = f"{uuid.uuid4().hex}_{os.path.basename(file.filename or 'file')}"
    with open(os.path.join(UPLOAD_DIR, safe), "wb") as f:
        f.write(data)
    files = list(vendor.evidence_files or [])
    files.append({"name": file.filename, "stored": safe, "questionId": questionId or None})
    vendor.evidence_files = files
    db.commit()
    return {"message": "Evidence uploaded.", "evidence": files}


@app.post("/api/vendor/submit-questionnaire")
def submit_questionnaire(
    email: str = Form(...), answers: str = Form(...), db: Session = Depends(get_db)
):
    parsed = json.loads(answers)  # { question_id: "response text" }

    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if not user:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    questions = _vendor_questions(db, user)

    # ── 100% completion gate: every assigned question must have a Yes/No/NA selected ──
    unanswered = [q.question_id for q in questions if not _norm_answer(parsed.get(q.question_id))["choice"]]
    if questions and unanswered:
        raise HTTPException(
            status_code=400,
            detail=f"Select Yes/No/NA for every question before submitting ({len(unanswered)} remaining).",
        )

    q_by_id = {q.question_id: q for q in questions}
    qa_pairs = []
    for qid, ans in parsed.items():
        a = _norm_answer(ans)
        q = q_by_id.get(qid)
        qa_pairs.append({
            "text": q.question_text if q else qid,
            "domain": q.domain if q else "General",
            "answer": f"{a['choice']}. {a['response']}".strip(". "),
        })

    user.submitted_answers = parsed
    user.draft_answers = parsed
    user.vendor_score = _tentative_score(db, parsed, user)  # AI score vs answer-key
    user.tprm_status = "Under Audit Review"
    # ── AI layer: generate the risk assessment for the auditor ──
    user.ai_risk_summary = ai.generate_risk_assessment(
        user.company_name or user.name, user.vendor_score, qa_pairs
    )
    db.commit()

    # ── Notify the triggering auditor + all admins ──
    admins = db.scalars(select(User).where(User.role == "admin")).all()
    recipients = list(dict.fromkeys(
        ([user.assigned_by] if user.assigned_by else []) + [a.email for a in admins]
    ))
    vendor_name = user.company_name or user.name
    # In-app notifications (bell)
    for r in recipients:
        if r:
            db.add(Notification(
                recipient_email=r.strip().lower(),
                message=f"{vendor_name} submitted their questionnaire and is ready for review.",
                vendor_name=vendor_name,
            ))
    db.commit()
    # Email (best-effort)
    notification = notify.send_submission_notification(vendor_name, user.email, recipients)

    return {
        "message": "Dossier uploaded successfully.",
        "aiRiskSummary": user.ai_risk_summary,
        "notification": notification,
    }


# ─── AUDITOR/ADMIN: full vendor detail for response review ───
@app.get("/api/admin/vendor/{vendor_id}")
def vendor_detail(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.get(User, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    questions = _vendor_questions(db, vendor)
    answers = vendor.submitted_answers or {}
    evidence = vendor.evidence_files or []
    return {
        "id": vendor.id,
        "companyName": vendor.company_name or vendor.name,
        "email": vendor.email,
        "tprmStatus": vendor.tprm_status,
        "assignedBy": vendor.assigned_by,
        "aiRiskSummary": vendor.ai_risk_summary,
        "vendorDetails": vendor.vendor_details or {},
        "evidence": evidence,
        "responses": [
            {
                "questionId": q.question_id,
                "domain": q.domain,
                "question": q.question_text,
                "choice": _norm_answer(answers.get(q.question_id))["choice"],
                "answer": _norm_answer(answers.get(q.question_id))["response"],
                "referenceChoice": q.reference_choice or "",
                "referenceAnswer": q.reference_answer or "",
                "attachments": [e for e in evidence if e.get("questionId") == q.question_id],
            }
            for q in questions
        ],
    }


@app.post("/api/admin/audit-action")
def compliance_audit_action(
    vendorId: str = Form(...), action: str = Form(...), comments: str = Form(""),
    db: Session = Depends(get_db),
):
    # action: pass | fail | close | return  (legacy: approve | reject)
    status_map = {
        "pass": "Verified",
        "approve": "Verified",
        "fail": "Action Required",
        "reject": "Action Required",
        "close": "Closed",
        "return": "Triggered",  # returned to the vendor to revise
    }
    if action not in status_map:
        raise HTTPException(status_code=400, detail="Unknown audit action.")
    user = db.get(User, int(vendorId))
    if not user:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    user.tprm_status = status_map[action]
    db.commit()
    return {"message": "Audit action recorded.", "tprmStatus": user.tprm_status}


@app.get("/api/admin/export-report/{vendor_id}")
def generate_pdf_dossier(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.get(User, vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"TPRM Dossier: {vendor.company_name or 'Vendor Profile'}", styles['Heading1']),
        Spacer(1, 15),
        Paragraph(f"Compliance Score Metrics: {vendor.vendor_score}%", styles['Heading3']),
        Paragraph(f"Workflow State: {vendor.tprm_status}", styles['Normal']),
    ]

    # ── Vendor Profile (submitted by the vendor) ──
    vd = vendor.vendor_details or {}
    if any(str(v).strip() for v in vd.values()):
        story += [Spacer(1, 15), Paragraph("Vendor Profile", styles['Heading3'])]
        field_labels = [
            ("legalName", "Legal Entity Name"), ("registrationNo", "Registration No."),
            ("address", "Registered Address"), ("country", "Country"), ("website", "Website"),
            ("contactName", "Primary Contact"), ("contactEmail", "Contact Email"),
            ("contactPhone", "Contact Phone"), ("securityContact", "Security/DPO Contact"),
            ("services", "Services Provided"),
        ]
        for key, label in field_labels:
            val = str(vd.get(key, "")).strip()
            if val:
                story.append(Paragraph(f"<b>{label}:</b> {val}", styles['Normal']))

    ai_summary = vendor.ai_risk_summary
    if ai_summary:
        story += [
            Spacer(1, 15),
            Paragraph(f"AI Risk Level: {ai_summary.get('risk_level', 'N/A')}", styles['Heading3']),
            Paragraph(ai_summary.get('summary', ''), styles['Normal']),
            Spacer(1, 8),
            Paragraph("Key Concerns:", styles['Heading4']),
        ]
        for concern in ai_summary.get('key_concerns', []):
            story.append(Paragraph(f"• {concern}", styles['Normal']))
        story += [
            Spacer(1, 8),
            Paragraph(f"Recommendation: {ai_summary.get('recommendation', '')}", styles['Normal']),
        ]
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf")


# ─── Evidence download ───
@app.get("/api/admin/evidence/{stored}")
def download_evidence(stored: str):
    safe = os.path.basename(stored)  # prevent path traversal
    path = os.path.join(UPLOAD_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Evidence file not found.")
    # Strip the uuid prefix to restore a friendly download name
    original = safe.split("_", 1)[-1] if "_" in safe else safe
    return FileResponse(path, filename=original)


# ─── In-app notifications (bell) ───
@app.get("/api/notifications")
def list_notifications(email: str, db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Notification)
        .where(Notification.recipient_email == email.strip().lower())
        .order_by(Notification.created_at.desc())
    ).all()
    return [
        {
            "id": n.id,
            "message": n.message,
            "vendorName": n.vendor_name,
            "isRead": n.is_read,
            "createdAt": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


@app.post("/api/notifications/mark-read")
def mark_notifications_read(email: str = Form(...), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Notification).where(
            Notification.recipient_email == email.strip().lower(),
            Notification.is_read == False,  # noqa: E712
        )
    ).all()
    for n in rows:
        n.is_read = True
    db.commit()
    return {"message": "Marked read.", "count": len(rows)}


# ══════════════════════════════════════════════════════════════════════
# SOC 2 INTERNAL AUDIT MODULE
# ══════════════════════════════════════════════════════════════════════

def _get_setting(db: Session, key: str, default: str = "") -> str:
    s = db.get(Setting, key)
    return s.value if s else default


def _set_setting(db: Session, key: str, value: str):
    s = db.get(Setting, key)
    if not s:
        s = Setting(key=key, value=value); db.add(s)
    else:
        s.value = value
    db.commit()


def _soc_state(db: Session) -> dict:
    return {
        "submittedForApproval": _get_setting(db, "soc_submitted_for_approval") == "1",
        "approved": _get_setting(db, "soc_approved") == "1",
        "triggered": _get_setting(db, "soc_triggered") == "1",
        "startedAt": _get_setting(db, "soc_started_at") or None,
        "collectionStopped": _get_setting(db, "soc_collection_stopped") == "1",
        "stopDate": _get_setting(db, "soc_stop_date") or None,
        "finalized": _get_setting(db, "soc_finalized") == "1",
        "week": _soc_audit_week(db),
        "lastReminderAt": _get_setting(db, "soc_last_reminder_at") or None,
        "lastReminderReason": _get_setting(db, "soc_last_reminder_reason") or None,
        "lastReminderCount": _get_setting(db, "soc_last_reminder_count") or None,
    }


def _soc_audit_week(db: Session):
    started = _get_setting(db, "soc_started_at")
    if not started or _get_setting(db, "soc_triggered") != "1":
        return None
    import soc_reminders
    return soc_reminders._audit_week(started)


# ─── AUDITOR: upload the control list (xlsx) ───
@app.post("/api/soc/upload-controls")
def soc_upload_controls(file: UploadFile = File(...), db: Session = Depends(get_db)):
    sheets = pd.read_excel(io.BytesIO(_validate_xlsx(file)), sheet_name=None, header=None)
    rows = []
    for name, df in sheets.items():
        raw = []
        for _, r in df.iterrows():
            cells = ["" if pd.isna(v) else str(v).strip() for v in r.tolist()]
            if any(cells):
                raw.append(cells)
        if not raw:
            continue
        # find the column-header row (must indicate a description column)
        cmap, hdr = None, None
        for i, row in enumerate(raw):
            low = [c.lower() for c in row]
            joined = " ".join(low)
            if "description" in joined or "control activity" in joined or "requirement" in joined:
                def col(cands):
                    for j, c in enumerate(low):
                        if any(h in c for h in cands):
                            return j
                    return None
                cmap = {
                    "id": col(["control id", "control no", "control #", "control ref", "ref", "s.no", "sno"]),
                    "domain": col(["domain", "category", "area", "trust service", "tsc", "section"]),
                    "desc": col(["control description", "description", "control activity", "requirement"]),
                }
                hdr = i
                break

        current_domain = name
        for i, row in enumerate(raw):
            if i == hdr:
                continue
            nonempty = [c for c in row if c]
            low = " ".join(c.lower() for c in row)
            if "description" in low or "control activity" in low:   # repeated header
                continue
            if len(nonempty) == 1 and not _re.fullmatch(r"[\d\.\)\(\s,:–—-]+", nonempty[0]):
                current_domain = nonempty[0]                        # domain/section header
                continue
            if cmap and cmap["desc"] is not None:
                desc = row[cmap["desc"]] if cmap["desc"] < len(row) else ""
                dom = (row[cmap["domain"]] if cmap["domain"] is not None and cmap["domain"] < len(row) else "") or current_domain
                cid = (row[cmap["id"]] if cmap["id"] is not None and cmap["id"] < len(row) else "")
            else:
                desc, dom, cid = (row[0] if row else ""), current_domain, ""
            if not desc or len(_re.findall(r"[A-Za-z]{2,}", desc)) < 2:
                continue
            rows.append({"desc": desc.strip(), "domain": (dom or "General").strip(), "cid": cid.strip()})

    if not rows:
        raise HTTPException(status_code=400, detail="No controls found. Expect a 'Control Description' (and optional 'Domain') column.")

    db.query(SocControl).delete()
    for idx, r in enumerate(rows, start=1):
        db.add(SocControl(control_id=r["cid"] or f"CTRL_{idx}", domain=r["domain"] or "General", description=r["desc"]))
    # reset approval/trigger/reminder state on new upload
    for k in ("soc_submitted_for_approval", "soc_approved", "soc_triggered",
              "soc_collection_stopped", "soc_finalized"):
        _set_setting(db, k, "0")
    for k in ("soc_last_reminder_at", "soc_last_reminder_reason", "soc_last_reminder_count"):
        _set_setting(db, k, "")
    db.commit()
    return {"message": f"Uploaded {len(rows)} control(s).", "count": len(rows)}


@app.get("/api/soc/controls")
def soc_list_controls(db: Session = Depends(get_db)):
    controls = db.scalars(select(SocControl).order_by(SocControl.id)).all()
    return {
        "state": _soc_state(db),
        "controls": [{
            "id": c.id, "controlId": c.control_id, "domain": c.domain, "description": c.description,
            "mappedTo": c.mapped_to, "status": c.status, "submitted": bool(c.submitted),
            "reviewStatus": c.review_status, "evidenceCount": len(c.evidence or []),
        } for c in controls],
    }


@app.post("/api/soc/controls/{cid}/map")
def soc_map_control(cid: int, stakeholderEmail: str = Form(...), db: Session = Depends(get_db)):
    c = db.get(SocControl, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Control not found.")
    c.mapped_to = stakeholderEmail.strip().lower() or None
    db.commit()
    return {"message": "Control mapped."}


@app.post("/api/soc/submit-for-approval")
def soc_submit_for_approval(db: Session = Depends(get_db)):
    controls = db.scalars(select(SocControl)).all()
    if not controls:
        raise HTTPException(status_code=400, detail="Upload a control list first.")
    unmapped = [c.control_id for c in controls if not c.mapped_to]
    if unmapped:
        raise HTTPException(status_code=400, detail=f"Map every control to a stakeholder first ({len(unmapped)} unmapped).")
    _set_setting(db, "soc_submitted_for_approval", "1")
    _set_setting(db, "soc_approved", "0")
    # notify admins
    admins = db.scalars(select(User).where(User.role == "admin")).all()
    notify.send_submission_notification("SOC 2 control list", "internal-audit", [a.email for a in admins])
    return {"message": "Submitted to admin for approval."}


# ─── ADMIN: approve / reject control list ───
@app.post("/api/soc/approve")
def soc_approve(approved: bool = Form(...), role: str = Form(""), db: Session = Depends(get_db)):
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only an admin can approve the SOC 2 control list.")
    _set_setting(db, "soc_approved", "1" if approved else "0")
    if not approved:
        _set_setting(db, "soc_submitted_for_approval", "0")
    return {"message": "Approved." if approved else "Sent back to auditor."}


# ─── AUDITOR: trigger audit → create stakeholder users + notify ───
@app.post("/api/soc/trigger")
def soc_trigger(db: Session = Depends(get_db)):
    if _get_setting(db, "soc_approved") != "1":
        raise HTTPException(status_code=400, detail="Control list must be approved by an admin first.")
    controls = db.scalars(select(SocControl)).all()
    emails = sorted({c.mapped_to for c in controls if c.mapped_to})
    created, dev_creds = 0, []
    for email in emails:
        u = db.scalar(select(User).where(User.email == email))
        if not u:
            name = email.split("@")[0].replace(".", " ").title()
            db.add(User(email=email, name=name, role="stakeholder",
                        password_hash=hash_password("AeroGuard@123"),
                        is_first_login=True, is_mfa_enabled=True, is_locked=False))
            created += 1
        dev_creds.append({"email": email, "password": "AeroGuard@123"})
    _set_setting(db, "soc_triggered", "1")
    _set_setting(db, "soc_started_at", datetime.now(timezone.utc).isoformat())
    db.commit()
    # email each stakeholder (best-effort) with their account
    for c in dev_creds:
        notify._log_fallback("SOC 2 audit access", [c["email"]],
                             f"You have been assigned SOC 2 controls. Login: {c['email']} / temporary password: AeroGuard@123 (MFA 123456).",
                             reason="stakeholder account")
    resp = {"message": f"Audit triggered. {created} new stakeholder account(s) created; all stakeholders notified.",
            "stakeholders": emails}
    if not os.getenv("SMTP_HOST"):
        resp["devCreds"] = dev_creds  # dev: surface default password
    return resp


# ─── STAKEHOLDER: my controls ───
@app.get("/api/soc/my-controls")
def soc_my_controls(email: str, db: Session = Depends(get_db)):
    em = email.strip().lower()
    controls = db.scalars(select(SocControl).where(SocControl.mapped_to == em).order_by(SocControl.id)).all()
    return {
        "state": _soc_state(db),
        "controls": [{
            "id": c.id, "controlId": c.control_id, "domain": c.domain, "description": c.description,
            "status": c.status or "", "remark": c.remark or "", "justification": c.justification or "",
            "evidence": c.evidence or [], "submitted": bool(c.submitted),
            "reviewStatus": c.review_status, "reviewComment": c.review_comment or "",
        } for c in controls],
    }


@app.post("/api/soc/control/save")
def soc_save_control(
    email: str = Form(...), controlId: int = Form(...),
    status: str = Form(""), remark: str = Form(""), justification: str = Form(""),
    db: Session = Depends(get_db),
):
    if _get_setting(db, "soc_collection_stopped") == "1":
        raise HTTPException(status_code=400, detail="Evidence collection has been closed by the auditor.")
    c = db.get(SocControl, controlId)
    if not c or c.mapped_to != email.strip().lower():
        raise HTTPException(status_code=404, detail="Control not assigned to you.")
    c.status, c.remark, c.justification = status.strip() or None, remark.strip() or None, justification.strip() or None
    db.commit()
    return {"message": "Saved."}


@app.post("/api/soc/control/upload-evidence")
def soc_upload_evidence(email: str = Form(...), controlId: int = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    if _get_setting(db, "soc_collection_stopped") == "1":
        raise HTTPException(status_code=400, detail="Evidence collection has been closed by the auditor.")
    c = db.get(SocControl, controlId)
    if not c or c.mapped_to != email.strip().lower():
        raise HTTPException(status_code=404, detail="Control not assigned to you.")
    data = file.file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB).")
    safe = f"{uuid.uuid4().hex}_{os.path.basename(file.filename or 'file')}"
    with open(os.path.join(UPLOAD_DIR, safe), "wb") as f:
        f.write(data)
    files = list(c.evidence or [])
    files.append({"name": file.filename, "stored": safe})
    c.evidence = files
    db.commit()
    return {"message": "Evidence uploaded.", "evidence": files}


@app.post("/api/soc/submit")
def soc_submit(email: str = Form(...), db: Session = Depends(get_db)):
    em = email.strip().lower()
    controls = db.scalars(select(SocControl).where(SocControl.mapped_to == em)).all()
    if not controls:
        raise HTTPException(status_code=404, detail="No controls assigned to you.")
    pending = [c.control_id for c in controls
               if not (c.status and (c.justification or "").strip() and (c.evidence or []))]
    if pending:
        raise HTTPException(status_code=400, detail=f"Every control needs a status, justification and evidence ({len(pending)} pending).")
    now = datetime.now(timezone.utc)
    for c in controls:
        c.submitted = True
        c.submitted_at = now
    db.commit()
    admins = db.scalars(select(User).where(User.role.in_(["admin", "internal_auditor"]))).all()
    notify.send_submission_notification(f"SOC 2 stakeholder {em}", em, [a.email for a in admins])
    return {"message": "Controls submitted for review."}


# ─── AUDITOR: review a control ───
@app.post("/api/soc/control/{cid}/review")
def soc_review_control(cid: int, action: str = Form(...), comment: str = Form(""), db: Session = Depends(get_db)):
    c = db.get(SocControl, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Control not found.")
    if action not in ("pass", "fail", "return"):
        raise HTTPException(status_code=400, detail="Invalid action.")
    c.review_status = action
    c.review_comment = comment.strip() or None
    if action == "return":
        c.submitted = False  # back to the stakeholder
    db.commit()
    return {"message": "Review recorded."}


# ─── AUDITOR/ADMIN: dashboard ───
@app.get("/api/soc/dashboard")
def soc_dashboard(db: Session = Depends(get_db)):
    controls = db.scalars(select(SocControl)).all()
    users = {u.email: u for u in db.scalars(select(User)).all()}
    by_sh = {}
    for c in controls:
        sh = c.mapped_to or "(unmapped)"
        d = by_sh.setdefault(sh, {"stakeholder": sh, "name": users.get(sh).name if users.get(sh) else "",
                                  "total": 0, "submitted": 0, "evidence": 0, "reviewed": 0})
        d["total"] += 1
        if c.submitted:
            d["submitted"] += 1
        if c.evidence:
            d["evidence"] += 1
        if c.review_status:
            d["reviewed"] += 1
    rows = list(by_sh.values())
    for r in rows:
        r["progress"] = round(100 * r["submitted"] / r["total"]) if r["total"] else 0
    return {"state": _soc_state(db), "stakeholders": rows,
            "totalControls": len(controls),
            "submittedControls": sum(1 for c in controls if c.submitted)}


# ─── STAKEHOLDER: help — list auditors + connect ───
@app.get("/api/soc/auditors")
def soc_auditors(db: Session = Depends(get_db)):
    auds = db.scalars(select(User).where(User.role == "internal_auditor")).all()
    return [{"name": a.name, "email": a.email, "mobile": a.mobile or ""} for a in auds]


@app.post("/api/soc/help-connect")
def soc_help_connect(stakeholderEmail: str = Form(...), auditorEmail: str = Form(...), message: str = Form(""), db: Session = Depends(get_db)):
    aud = db.scalar(select(User).where(User.email == auditorEmail.strip().lower()))
    if not aud:
        raise HTTPException(status_code=404, detail="Auditor not found.")
    db.add(Notification(recipient_email=aud.email,
                        message=f"Help requested by stakeholder {stakeholderEmail}: {message or '(no message)'}",
                        vendor_name=stakeholderEmail))
    db.commit()
    notify._log_fallback("SOC 2 help request", [aud.email],
                         f"{stakeholderEmail} requests help: {message}", reason="help connect")
    return {"message": f"Your request has been sent to {aud.name or aud.email}."}


# ─── AUDITOR: stop evidence collection ───
@app.post("/api/soc/stop-collection")
def soc_stop_collection(stopDate: str = Form(...), db: Session = Depends(get_db)):
    _set_setting(db, "soc_collection_stopped", "1")
    _set_setting(db, "soc_stop_date", stopDate.strip())
    stakeholders = sorted({c.mapped_to for c in db.scalars(select(SocControl)).all() if c.mapped_to})
    notify._log_fallback("SOC 2 evidence collection closing", stakeholders,
                         f"Evidence collection will be stopped effective {stopDate}. After this date you will only receive a summarised status email.",
                         reason="stop collection")
    return {"message": f"Evidence collection stopped (effective {stopDate}). {len(stakeholders)} stakeholder(s) notified."}


# ─── Reports ───
def _soc_pdf(title: str, controls):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = [Paragraph(title, styles["Heading1"]), Spacer(1, 12)]
    cur = None
    for c in controls:
        if c.domain != cur:
            cur = c.domain
            story += [Spacer(1, 8), Paragraph(cur, styles["Heading3"])]
        story.append(Paragraph(f"<b>{c.control_id}:</b> {c.description}", styles["Normal"]))
        story.append(Paragraph(f"Status: {c.status or '—'} · Review: {c.review_status or 'pending'}", styles["Normal"]))
        if c.justification:
            story.append(Paragraph(f"Justification: {c.justification}", styles["Normal"]))
        story.append(Spacer(1, 6))
    doc.build(story)
    buffer.seek(0)
    return buffer


@app.get("/api/soc/report/full")
def soc_report_full(db: Session = Depends(get_db)):
    controls = db.scalars(select(SocControl).order_by(SocControl.domain, SocControl.id)).all()
    return StreamingResponse(_soc_pdf("SOC 2 Internal Audit — Full Report", controls), media_type="application/pdf")


@app.get("/api/soc/report/stakeholder/{email}")
def soc_report_stakeholder(email: str, db: Session = Depends(get_db)):
    em = email.strip().lower()
    controls = db.scalars(select(SocControl).where(SocControl.mapped_to == em).order_by(SocControl.domain, SocControl.id)).all()
    return StreamingResponse(_soc_pdf(f"SOC 2 Audit Report — {em}", controls), media_type="application/pdf")


# ─── REMINDERS (Phase 2): cadence engine ───
@app.get("/api/soc/reminders")
def soc_reminders_status(db: Session = Depends(get_db)):
    """Reminder schedule + last-run info for the dashboard."""
    import soc_reminders
    return {
        "state": _soc_state(db),
        "schedule": [
            {"phase": "Week 1-2", "days": "Tue, Thu", "times": "10:00, 15:30"},
            {"phase": "Week 3-4", "days": "Tue, Thu, Fri", "times": "10:00, 15:30"},
            {"phase": "Week 5+", "days": "Daily", "times": "11:00"},
            {"phase": "After stop-collection", "days": "Daily (summary only)", "times": "11:00"},
        ],
        "upcoming": soc_reminders.next_runs(),
    }


@app.post("/api/soc/run-reminders")
def soc_run_reminders(force: bool = Form(True), db: Session = Depends(get_db)):
    """Manually fire a reminder cycle now (used for verification / on-demand nudge)."""
    import soc_reminders
    result = soc_reminders.run_reminders("manual", force=bool(force))
    return {"message": f"Reminder cycle ran — {result.get('sent', 0)} stakeholder(s) emailed.", **result}


@app.post("/api/soc/finalize")
def soc_finalize(db: Session = Depends(get_db)):
    """Conclude the audit: stop all reminders. Set once the report is final."""
    _set_setting(db, "soc_finalized", "1")
    return {"message": "Audit concluded. Automated reminders are now stopped.", "state": _soc_state(db)}
