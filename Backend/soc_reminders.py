"""SOC 2 evidence-collection reminder engine (Phase 2).

In-process APScheduler that emails stakeholders a *summarised status* of their
assigned controls on a cadence that escalates with the age of the audit:

    Week 1-2 : Tue & Thu, twice a day (10:00 and 15:30)
    Week 3-4 : Tue, Thu & Fri, twice a day (10:00 and 15:30)
    Week 5+  : every day at 11:00
    After "stop collection" : every day at 11:00 (summary-only mode), regardless
                              of week, until the auditor concludes the audit.

Reminders stop once the audit is concluded (soc_finalized) or no longer triggered.
Emails go out best-effort via notify.send_email (logs to notifications.log in dev).
"""
import os
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

import notify

_scheduler = None


# ─── helpers (import lazily to avoid circulars at module load) ───
def _session():
    from db import SessionLocal
    return SessionLocal()


def _audit_week(started_at_iso: str) -> int:
    """1-based week number since the audit was triggered (week 1 = first 7 days)."""
    try:
        started = datetime.fromisoformat(started_at_iso)
    except (ValueError, TypeError):
        return 1
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - started).days
    return max(1, days // 7 + 1)


def _stakeholder_summaries(db):
    """Per-stakeholder roll-up of control completion, keyed by email."""
    from db import SocControl, User
    from sqlalchemy import select
    controls = db.scalars(select(SocControl)).all()
    users = {u.email: u for u in db.scalars(select(User)).all()}
    out = {}
    for c in controls:
        sh = c.mapped_to
        if not sh:
            continue
        d = out.setdefault(sh, {
            "email": sh,
            "name": users[sh].name if sh in users else sh.split("@")[0].title(),
            "total": 0, "filled": 0, "submitted": 0, "pending": 0,
            "pending_ids": [],
        })
        d["total"] += 1
        filled = bool(c.status and c.justification and c.evidence)
        if filled:
            d["filled"] += 1
        if c.submitted:
            d["submitted"] += 1
        if not c.submitted:
            d["pending"] += 1
            d["pending_ids"].append(c.control_id)
    for d in out.values():
        d["progress"] = round(100 * d["submitted"] / d["total"]) if d["total"] else 0
    return out


def _compose_body(summary: dict, week: int, stopped: bool, stop_date: str) -> str:
    pend = summary["pending_ids"]
    pend_txt = ", ".join(pend[:12]) + ("…" if len(pend) > 12 else "") if pend else "none — all submitted 🎉"
    lines = [
        f"Hello {summary['name']},",
        "",
        "Here is the current status of your assigned SOC 2 controls:",
        "",
        f"  • Submitted : {summary['submitted']} / {summary['total']}  ({summary['progress']}%)",
        f"  • Ready (status+justification+evidence, not yet submitted): "
        f"{summary['filled'] - summary['submitted'] if summary['filled'] >= summary['submitted'] else 0}",
        f"  • Pending   : {summary['pending']}",
        f"  • Pending controls: {pend_txt}",
        "",
    ]
    if stopped:
        lines += [f"NOTE: Evidence collection has been stopped (effective {stop_date}). "
                  "This is a summarised status update only — submissions are closed.", ""]
    elif week >= 5:
        lines += ["This is a daily reminder. Please complete and submit your pending controls "
                  "in the AeroGuard portal as soon as possible.", ""]
    else:
        lines += ["Please log in to the AeroGuard portal to complete and submit your pending controls.", ""]
    lines += ["— AeroGuard Internal Audit (automated reminder)"]
    return "\n".join(lines)


def run_reminders(reason: str, force: bool = False) -> dict:
    """Send a summarised-status reminder to every stakeholder with pending work.

    `reason` is the cadence slot label (e.g. "tue_thu_10"). When `force` is False the
    function self-checks whether this slot is active for the current audit week/state.
    Returns a dict describing what was sent (used by the manual /run-reminders endpoint).
    """
    db = _session()
    try:
        def g(k):
            from db import Setting
            s = db.get(Setting, k)
            return s.value if s else ""

        triggered = g("soc_triggered") == "1"
        finalized = g("soc_finalized") == "1"
        stopped = g("soc_collection_stopped") == "1"
        stop_date = g("soc_stop_date")
        started_at = g("soc_started_at")

        if not triggered or finalized:
            return {"sent": 0, "skipped": True, "reason": "audit not active"}

        week = _audit_week(started_at) if started_at else 1
        if not force and not _slot_active(reason, week, stopped):
            return {"sent": 0, "skipped": True, "reason": f"slot {reason} inactive (week {week}, stopped={stopped})"}

        summaries = _stakeholder_summaries(db)
        targets = [s for s in summaries.values() if s["pending"] > 0]
        sent = []
        for s in targets:
            body = _compose_body(s, week, stopped, stop_date)
            subject = f"[SOC 2] Status reminder — {s['submitted']}/{s['total']} controls submitted"
            notify.send_email(subject, [s["email"]], body, reason=f"soc reminder ({reason})")
            # in-app notification too
            from db import Notification
            db.add(Notification(
                recipient_email=s["email"],
                message=f"SOC 2 reminder: {s['pending']} control(s) still pending "
                        f"({s['submitted']}/{s['total']} submitted).",
                vendor_name="SOC 2 Internal Audit",
            ))
            sent.append(s["email"])

        # record last-run metadata for the dashboard
        from db import Setting
        for k, v in (("soc_last_reminder_at", datetime.now(timezone.utc).isoformat()),
                     ("soc_last_reminder_reason", reason),
                     ("soc_last_reminder_count", str(len(sent)))):
            st = db.get(Setting, k)
            if st:
                st.value = v
            else:
                db.add(Setting(key=k, value=v))
        db.commit()
        return {"sent": len(sent), "recipients": sent, "week": week,
                "stopped": stopped, "reason": reason}
    finally:
        db.close()


def _slot_active(slot: str, week: int, stopped: bool) -> bool:
    """Decide whether a cron slot should fire for the given audit week / stop state."""
    if stopped:
        # summary-only daily mode after collection is stopped
        return slot == "daily_11"
    if slot in ("tue_thu_10", "tue_thu_1530"):
        return 1 <= week <= 4
    if slot in ("fri_10", "fri_1530"):
        return 3 <= week <= 4
    if slot == "daily_11":
        return week >= 5
    return False


def start_scheduler():
    """Install cron jobs once. Each job self-checks the audit week before sending."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    sched = BackgroundScheduler(timezone=os.getenv("SOC_TZ", "Asia/Kolkata"))

    def job(slot):
        return lambda: run_reminders(slot)

    # Week 1-4 : Tue & Thu at 10:00 and 15:30
    sched.add_job(job("tue_thu_10"), CronTrigger(day_of_week="tue,thu", hour=10, minute=0), id="tue_thu_10")
    sched.add_job(job("tue_thu_1530"), CronTrigger(day_of_week="tue,thu", hour=15, minute=30), id="tue_thu_1530")
    # Week 3-4 : add Friday at 10:00 and 15:30
    sched.add_job(job("fri_10"), CronTrigger(day_of_week="fri", hour=10, minute=0), id="fri_10")
    sched.add_job(job("fri_1530"), CronTrigger(day_of_week="fri", hour=15, minute=30), id="fri_1530")
    # Week 5+ / post-stop : daily at 11:00
    sched.add_job(job("daily_11"), CronTrigger(hour=11, minute=0), id="daily_11")

    sched.start()
    _scheduler = sched
    return sched


def next_runs() -> list:
    """Upcoming fire times for each job (for display)."""
    if _scheduler is None:
        return []
    out = []
    for j in _scheduler.get_jobs():
        nxt = j.next_run_time
        out.append({"slot": j.id, "next": nxt.isoformat() if nxt else None})
    return out
