"""Email notifications (best-effort).

On vendor submission, notifies the auditor who triggered the questionnaire plus
all platform admins. If SMTP isn't configured, the notification is logged to
Backend/notifications.log so the flow still works in local/dev mode.

Configure via env vars to send real email:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
"""
import os
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone


def send_submission_notification(vendor_name: str, vendor_email: str, recipients: list) -> dict:
    """Notify recipients that a vendor submitted their questionnaire. Never raises."""
    recipients = [r for r in dict.fromkeys(recipients) if r]  # dedupe, drop empties
    if not recipients:
        return {"sent": False, "reason": "no recipients"}

    subject = f"[AeroGuard] {vendor_name} has submitted their questionnaire"
    body = (
        f"Vendor: {vendor_name} ({vendor_email})\n"
        f"Submitted at: {datetime.now(timezone.utc).isoformat()}\n\n"
        f"The vendor has completed and submitted their security self-assessment. "
        f"Please review the responses in the AeroGuard portal."
    )

    host = os.getenv("SMTP_HOST")
    if host:
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "aeroguard@aeroguard.com"))
            msg["To"] = ", ".join(recipients)
            with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as server:
                server.starttls()
                user, password = os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD")
                if user and password:
                    server.login(user, password)
                server.sendmail(msg["From"], recipients, msg.as_string())
            return {"sent": True, "recipients": recipients}
        except Exception as exc:  # noqa: BLE001 — never break submission
            return _log_fallback(subject, recipients, body, reason=f"SMTP failed: {exc}")
    return _log_fallback(subject, recipients, body, reason="SMTP not configured")


def send_email(subject: str, recipients: list, body: str, reason: str = "notification") -> dict:
    """Generic best-effort email. Sends via SMTP when configured, else logs. Never raises."""
    recipients = [r for r in dict.fromkeys(recipients) if r]  # dedupe, drop empties
    if not recipients:
        return {"sent": False, "reason": "no recipients"}
    host = os.getenv("SMTP_HOST")
    if host:
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "aeroguard@aeroguard.com"))
            msg["To"] = ", ".join(recipients)
            with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as server:
                server.starttls()
                user, password = os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD")
                if user and password:
                    server.login(user, password)
                server.sendmail(msg["From"], recipients, msg.as_string())
            return {"sent": True, "recipients": recipients}
        except Exception as exc:  # noqa: BLE001 — never break the caller
            return _log_fallback(subject, recipients, body, reason=f"SMTP failed: {exc}")
    return _log_fallback(subject, recipients, body, reason=reason)


def _log_fallback(subject: str, recipients: list, body: str, reason: str) -> dict:
    line = (
        f"\n=== {datetime.now(timezone.utc).isoformat()} === ({reason})\n"
        f"TO: {', '.join(recipients)}\nSUBJECT: {subject}\n{body}\n"
    )
    try:
        log_path = os.path.join(os.path.dirname(__file__), "notifications.log")
        with open(log_path, "a") as f:
            f.write(line)
    except Exception:
        pass
    return {"sent": False, "logged": True, "reason": reason, "recipients": recipients}
