"""AI layer — vendor risk assessment powered by Claude (Anthropic).

Given a vendor's submitted security self-assessment answers, Claude produces a
structured third-party risk evaluation that auditors see in the Audit Dossier.

Requires ANTHROPIC_API_KEY in the environment. If the key is absent (or the call
fails) the functions degrade gracefully so the rest of the platform keeps working.
"""
import os
import re
from typing import List, Optional

from pydantic import BaseModel, Field

MODEL = "claude-opus-4-8"


class RiskAssessment(BaseModel):
    """Structured output schema Claude is constrained to return."""
    risk_level: str = Field(description="One of: Low, Medium, High, Critical")
    summary: str = Field(description="2-3 sentence executive summary of the vendor's risk posture")
    key_concerns: List[str] = Field(description="Specific gaps or non-compliant controls worth flagging")
    recommendation: str = Field(description="Recommended action for the auditor")


def _build_prompt(company_name: str, score: int, qa_pairs: List[dict]) -> str:
    lines = [
        f"Vendor: {company_name}",
        f"Automated compliance score: {score}%",
        "",
        "Security self-assessment responses:",
    ]
    for qa in qa_pairs:
        lines.append(
            f"- [{qa.get('domain', 'General')}] {qa.get('text', '')} -> {qa.get('answer', 'N/A')}"
        )
    lines += [
        "",
        "You are a third-party risk management (TPRM) analyst. Review the responses "
        "above and produce a concise, evidence-based risk assessment. Treat 'No' "
        "answers as non-compliant controls and weigh them by how security-critical "
        "the domain is.",
    ]
    return "\n".join(lines)


def generate_risk_assessment(
    company_name: str, score: int, qa_pairs: List[dict]
) -> Optional[dict]:
    """Call Claude to produce a structured risk assessment.

    Returns a dict matching RiskAssessment, or a deterministic fallback dict if
    the AI layer is unavailable. Never raises.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or api_key.startswith("sk-ant-...") or api_key == "":
        return _fallback(score, reason="ANTHROPIC_API_KEY not configured")

    try:
        import anthropic

        client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
        response = client.messages.parse(
            model=MODEL,
            max_tokens=2000,
            thinking={"type": "adaptive"},
            system=(
                "You are a senior third-party risk management analyst for an "
                "enterprise. Be precise, conservative, and actionable."
            ),
            messages=[{"role": "user", "content": _build_prompt(company_name, score, qa_pairs)}],
            output_format=RiskAssessment,
        )
        parsed = response.parsed_output
        if parsed is None:
            return _fallback(score, reason="Model returned no structured output")
        return parsed.model_dump()
    except Exception as exc:  # noqa: BLE001 — never break the submission flow
        return _fallback(score, reason=f"AI call failed: {exc}")


_STOP = {"the", "a", "an", "and", "or", "to", "of", "is", "are", "we", "our", "in",
         "for", "with", "on", "at", "by", "be", "as", "that", "this", "have", "has", "do"}


def _tokens(s: str) -> set:
    return {t for t in re.findall(r"[a-z0-9]+", (s or "").lower()) if t not in _STOP}


def question_similarity(a: str, b: str) -> float:
    """Containment similarity (0-1) — robust for near-duplicate questions where one
    phrasing largely overlaps the other."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return inter / min(len(ta), len(tb))


def is_duplicate_question(text: str, existing_texts: List[str], threshold: float = 0.8) -> bool:
    """AI-sense dedupe: True if `text` is a near-duplicate of any existing question."""
    return any(question_similarity(text, e) >= threshold for e in existing_texts)


# ── Information Security domain taxonomy (keyword "sense") ──
INFOSEC_DOMAINS = {
    "Access Control & Identity": [
        "access control", "access", "password", "passphrase", "mfa", "multi-factor",
        "authentication", "authorization", "privilege", "least privilege", "identity",
        "login", "rbac", "role-based", "sso", "single sign", "account", "credential", "iam"],
    "Data Security & Privacy": [
        "encrypt", "encryption", "cryptograph", "data at rest", "data in transit",
        "key management", "tls", "ssl", "pii", "personal data", "confidential",
        "data classification", "masking", "tokeni", "dlp", "data loss", "privacy",
        "gdpr", "retention", "data protection"],
    "Network Security": [
        "firewall", "network", "vpn", "segmentation", "intrusion", "ids", "ips",
        "ddos", "perimeter", "port", "wireless", "wifi", "router", "gateway", "proxy"],
    "Application & Software Security": [
        "application security", "software", "sdlc", "secure coding", "owasp",
        "code review", "sast", "dast", "api security", "dependency", "web application",
        "input validation", "source code"],
    "Vulnerability & Patch Management": [
        "vulnerability", "patch", "vulnerability scan", "scanning", "pen test",
        "penetration", "remediation", "cve", "hardening"],
    "Incident Management": [
        "incident", "breach", "incident response", "ir plan", "forensic", "detection",
        "soc", "alerting", "containment", "incident report"],
    "Business Continuity & Disaster Recovery": [
        "business continuity", "disaster recovery", "bcp", "dr plan", "rto", "rpo",
        "resilience", "failover", "backup", "restore", "continuity"],
    "Physical & Environmental Security": [
        "physical security", "physical", "premises", "cctv", "badge", "facility",
        "data center", "datacenter", "environmental", "access card", "visitor", "fire suppression"],
    "Human Resources Security": [
        "background check", "background verification", "training", "awareness",
        "onboarding", "offboarding", "employee", "staff", "nda", "non-disclosure",
        "personnel", "screening", "termination"],
    "Third-Party / Vendor Risk": [
        "vendor", "third party", "third-party", "supplier", "subcontractor",
        "outsourcing", "supply chain", "fourth party", "sub-processor"],
    "Governance, Risk & Compliance": [
        "policy", "compliance", "audit", "governance", "risk assessment", "iso 27001",
        "iso27001", "soc 2", "soc2", "regulatory", "standard", "framework",
        "certification", "risk management", "control"],
    "Asset Management": [
        "asset", "inventory", "hardware", "device", "endpoint", "mobile device",
        "byod", "media", "disposal", "asset register"],
    "Logging & Monitoring": [
        "logging", "log ", "logs", "monitoring", "audit trail", "siem", "event log", "alert"],
    "Operations Security": [
        "change management", "configuration", "capacity", "malware", "antivirus",
        "anti-virus", "endpoint protection", "operations", "secure configuration"],
}


def categorize_question(text: str) -> str:
    """Classify a question into an InfoSec domain by keyword sense. Returns the
    best-matching domain, or 'General Security' if nothing matches."""
    t = " " + (text or "").lower() + " "
    best_domain, best_score = "General Security", 0
    for domain, keywords in INFOSEC_DOMAINS.items():
        score = 0
        for kw in keywords:
            if kw in t:
                # longer/more-specific phrases weigh more
                score += 2 if " " in kw else 1
        if score > best_score:
            best_domain, best_score = domain, score
    return best_domain


def best_answer_match(question: str, bank: List[dict], threshold: float = 0.4):
    """Find the closest question in the answer bank and return (item, score).
    `bank` items are {"text": ..., "answer": ...}. Returns (None, score) below threshold."""
    best, best_score = None, 0.0
    for item in bank:
        s = question_similarity(question, item.get("text", ""))
        if s > best_score:
            best, best_score = item, s
    if best_score < threshold:
        return None, best_score
    return best, best_score


def normalize_choice(val: str) -> str:
    """Map free text to a canonical Yes / No / NA (or '')."""
    v = str(val or "").strip().lower()
    if v in ("yes", "y", "compliant", "true", "1"):
        return "Yes"
    if v in ("no", "n", "non-compliant", "noncompliant", "false", "0"):
        return "No"
    if v in ("na", "n/a", "not applicable", "n.a", "n.a."):
        return "NA"
    return ""


def compute_tentative_score(items: List[dict]) -> int:
    """Tentative score (0-100) of vendor answers vs. the answer-key. Each item:
    {choice, response, refChoice, refAnswer}. Combines a Yes/No/NA-match component
    with a written-response overlap component. Fast enough to run on every autosave."""
    if not items:
        return 0
    per_question = []
    for it in items:
        choice = normalize_choice(it.get("choice"))
        resp = str(it.get("response") or "").strip().lower()
        ref_choice = normalize_choice(it.get("refChoice"))
        ref_ans = str(it.get("refAnswer") or "").strip().lower()

        if not choice and not resp:
            per_question.append(0)
            continue

        # Choice component (up to 70)
        if ref_choice:
            score = 70 if choice == ref_choice else 20
        else:
            score = 50 if choice else 30  # no key — credit for answering

        # Written-response overlap component (up to 30)
        if ref_ans and resp:
            rt = {t for t in re.findall(r"[a-z0-9]+", resp) if t not in _STOP}
            ft = {t for t in re.findall(r"[a-z0-9]+", ref_ans) if t not in _STOP}
            overlap = (len(rt & ft) / len(ft)) if ft else 0
            score += int(min(30, overlap * 30))
        elif resp:
            score += 10

        per_question.append(min(100, score))
    return int(round(sum(per_question) / len(per_question)))


def generate_help(question: str, domain: str) -> str:
    """AI guidance for a vendor on how to answer a questionnaire item — tailored by
    actually reading the question. Guidance only: never a Yes/No verdict, never the
    answer-key, never invented facts about the vendor. Never raises."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if api_key and not api_key.startswith("sk-ant-..."):
        try:
            import anthropic
            client = anthropic.Anthropic()
            resp = client.messages.create(
                model=MODEL,
                max_tokens=700,
                thinking={"type": "adaptive"},
                system=(
                    "You are a third-party risk (TPRM) assistant helping a vendor write a strong "
                    "answer to ONE security-questionnaire item. Read the exact question carefully, "
                    "infer precisely what the assessor is asking for, then give tailored, specific "
                    "guidance.\n"
                    "Rules:\n"
                    "- 3-5 concise bullets, each on what THIS question wants the vendor to evidence "
                    "(specific controls, standards, tooling, frequency, ownership, metrics).\n"
                    "- End with one line: which evidence/document to attach.\n"
                    "- Do NOT answer Yes/No or No/NA for them. Do NOT fabricate details about their "
                    "company. Do NOT reveal or guess any 'expected answer'. Guide only."
                ),
                messages=[{"role": "user", "content": f"Domain: {domain}\nQuestion: \"{question}\""}],
            )
            text = next((b.text for b in resp.content if b.type == "text"), "")
            if text.strip():
                return text.strip()
        except Exception:  # noqa: BLE001 — fall back to question-aware heuristic
            pass
    return _help_fallback(question, domain)


# Topic → tailored guidance (matched against the actual question text)
_HELP_TOPICS = [
    (("encrypt", "encryption", "aes", "cipher", "at rest", "in transit", "tls", "ssl"),
     "encryption", "State the standard (e.g. AES-256 at rest, TLS 1.2+ in transit) and the scope it covers (DB, backups, endpoints)."),
    (("key", "kms", "hsm", "key management", "rotation"),
     "key management", "Describe key generation, storage (HSM/key vault), rotation cadence, and who can access keys."),
    (("mfa", "multi-factor", "two-factor", "2fa", "otp", "totp"),
     "multi-factor authentication", "Specify where MFA is enforced (admin, remote, all users), the factor types, and any exceptions."),
    (("password", "credential", "complexity", "lockout"),
     "password policy", "Give the complexity, rotation, lockout and history rules, and how default credentials are removed."),
    (("access review", "access right", "least privilege", "rbac", "role-based", "provision", "deprovision", "joiner", "leaver"),
     "access control", "Cover least-privilege/RBAC, joiner-mover-leaver process, and the frequency of access reviews."),
    (("privileged", "pam", "admin access", "root", "service account"),
     "privileged access", "Describe PAM tooling, just-in-time access, session logging, and review of privileged accounts."),
    (("backup", "restore", "recovery", "rto", "rpo", "immutable", "offsite"),
     "backup & recovery", "State backup frequency, retention, encryption, offsite/immutable copies, and tested RTO/RPO."),
    (("disaster", "continuity", "bcp", "dr ", "resilience", "failover"),
     "business continuity", "Reference your BCP/DR plan, test frequency, and recovery objectives for client services."),
    (("incident", "breach", "ir plan", "forensic", "notification", "escalation"),
     "incident response", "Outline detection, the IR plan, escalation SLAs, and customer breach-notification timelines."),
    (("vulnerability", "vapt", "scan", "cve", "remediation"),
     "vulnerability management", "Give scan frequency, prioritisation (CVSS/asset criticality), and remediation SLAs."),
    (("patch", "hardening", "cis benchmark", "baseline", "stig"),
     "patch & hardening", "Describe your patch SLA by severity and secure baselines (e.g. CIS benchmarks) you apply."),
    (("pen test", "penetration", "red team"),
     "penetration testing", "State who performs pen-tests, how often, scope, and how findings are tracked to closure."),
    (("sast", "dast", "secure coding", "sdlc", "ci/cd", "owasp", "code review"),
     "secure development", "Cover your secure-SDLC, SAST/DAST in CI/CD, code review, and OWASP-aligned controls."),
    (("api", "gateway", "rate limit", "oauth", "token"),
     "API security", "Describe authentication, rate-limiting, gateway controls, and logging/anomaly detection for APIs."),
    (("waf", "firewall", "segmentation", "vlan", "acl", "network", "ids", "ips", "vpn", "nac"),
     "network security", "Explain perimeter controls (firewall/WAF, deny-by-default), segmentation, and remote-access controls."),
    (("log", "logging", "siem", "monitor", "audit trail", "alert"),
     "logging & monitoring", "Describe centralised logging/SIEM, what events are captured, retention, and alerting/SOC coverage."),
    (("asset", "inventory", "cmdb", "byod", "endpoint", "edr", "xdr", "mdm", "media", "disposal"),
     "asset & endpoint", "Cover the asset inventory/CMDB, ownership, endpoint protection (EDR/MDM), and secure media disposal."),
    (("dlp", "data loss", "exfiltration"),
     "data loss prevention", "Describe DLP coverage across email/endpoint/cloud and how unauthorised transfers are blocked."),
    (("classification", "label", "pii", "phi", "privacy", "gdpr", "dpdp", "retention", "consent"),
     "data privacy", "Cover data classification, PII handling/minimisation, retention/deletion, and applicable privacy laws."),
    (("third party", "third-party", "vendor", "subcontractor", "sub-processor", "supply chain", "fourth party"),
     "third-party risk", "Explain how you assess sub-processors, flow down security terms, and monitor them over time."),
    (("training", "awareness", "phishing"),
     "security awareness", "State training frequency, phishing simulations, and completion tracking."),
    (("background", "screening", "onboarding", "offboarding", "nda", "termination", "personnel"),
     "personnel security", "Cover background checks, NDAs, and joiner/leaver security steps."),
    (("iso 27001", "iso27001", "soc 2", "soc2", "pci", "certification", "policy", "governance", "compliance", "audit"),
     "governance & compliance", "Reference the relevant policy/standard and certifications (ISO 27001, SOC 2, PCI) you can attach."),
    (("change management", "configuration", "pir"),
     "change management", "Describe change approval, testing, security impact assessment, and post-implementation review."),
    (("physical", "data center", "datacenter", "cctv", "badge", "premises"),
     "physical security", "Cover facility access controls (badges/CCTV), visitor management, and environmental safeguards."),
    (("cloud", "saas", "iaas", "shared responsibility", "residency", "sovereignty", "multi-tenant"),
     "cloud security", "State the cloud model, shared-responsibility split, data residency, and tenant isolation."),
    (("segregation of duties", "sod"),
     "segregation of duties", "Describe how conflicting duties are separated and how SoD violations are detected."),
    (("secret", "vault", "hardcoded", "api key"),
     "secrets management", "Cover use of a secrets vault, no hard-coded credentials, and scanning for exposed secrets."),
]


def _help_fallback(question: str, domain: str) -> str:
    q = (question or "").lower()
    topics, tips = [], []
    for keys, label, tip in _HELP_TOPICS:
        if any(k in q for k in keys):
            topics.append(label)
            tips.append(tip)

    intro = (f"For this question about {topics[0]}, a strong answer should cover:"
             if topics else
             f"For this {domain} question, a strong, auditable answer should cover:")

    if not tips:
        tips.append("The specific controls, tooling and processes you have in place for exactly what is asked.")
    # Detect evidence/documentation requests in the wording
    if any(w in q for w in ("provide", "share", "evidence", "document", "attach", "report", "details", "outline", "describe")):
        tips.append("Concrete details the assessor asked for — name the tools, owners and frequency, not just 'Yes'.")
    tips.append("Attach supporting evidence (policy, certificate, scan report or screenshot) and add it in Vendor Remarks.")

    # De-duplicate while preserving order, cap at 5
    seen, ordered = set(), []
    for t in tips:
        if t not in seen:
            seen.add(t); ordered.append(t)
    return intro + "\n" + "\n".join(f"• {t}" for t in ordered[:5])


def _fallback(score: int, reason: str) -> dict:
    """Heuristic assessment used when Claude is unavailable."""
    if score >= 85:
        level = "Low"
    elif score >= 60:
        level = "Medium"
    elif score >= 40:
        level = "High"
    else:
        level = "Critical"
    return {
        "risk_level": level,
        "summary": f"Heuristic assessment based on a {score}% compliance score. "
                   f"(AI assessment unavailable: {reason})",
        "key_concerns": ["AI-generated concerns unavailable — review answers manually."],
        "recommendation": "Manual auditor review recommended.",
    }
