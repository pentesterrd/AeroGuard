import React, { useState, useEffect } from "react";
import axios from 'axios';
import aeroLogo from "./assets/aeroguard-logo.png";

// AeroGuard brand mark — eagle + shield emblem with wordmark
function Logo({ height = 34, showText = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: height * 0.28, lineHeight: 1 }} aria-label="AeroGuard">
      <img src={aeroLogo} alt="AeroGuard" style={{ height, width: "auto", display: "block" }} />
      {showText && (
        <span style={{ fontSize: height * 0.58, fontWeight: 800, letterSpacing: 0.5, color: "#1E3A5F", whiteSpace: "nowrap" }}>
          Aero<span style={{ color: "#3E7CB1" }}>Guard</span>
        </span>
      )}
    </div>
  );
}

// Small company attribution banner shown on every page
function ShiprocketBanner({ variant = "topbar" }) {
  if (variant === "auth") {
    return (
      <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: "#94A3B8" }}>
        Powered by <span style={{ fontWeight: 800, color: "#733CF2" }}>🚀 Shiprocket</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 10, color: "#94A3B8", letterSpacing: 1, textTransform: "uppercase" }}>Powered by</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "linear-gradient(90deg,#8B6BF7,#5B2FD6)", color: "white", fontWeight: 800, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>🚀 Shiprocket</span>
    </div>
  );
}

// Map an InfoSec domain name to a relevant icon
function domainIcon(domain) {
  const d = (domain || "").toLowerCase();
  const map = [
    [["access", "identity", "authentication", "iam", "mfa", "password"], "🔑"],
    [["data security", "data ", "privacy", "encryption", "dlp", "pii", "gdpr", "dpdp"], "🔒"],
    [["network"], "🌐"],
    [["application", "software", "sdlc", "api", "code"], "🧑‍💻"],
    [["vulnerability", "patch"], "🩹"],
    [["incident", "breach"], "🚨"],
    [["continuity", "disaster", "recovery", "bcp", "dr"], "🔄"],
    [["physical", "environmental"], "🏛️"],
    [["human", "hr", "personnel", "training"], "🧑‍💼"],
    [["third", "vendor", "supplier", "subcontractor", "supply chain"], "🤝"],
    [["governance", "compliance", "risk", "audit", "grc"], "⚖️"],
    [["asset"], "💻"],
    [["logging", "monitoring", "siem"], "🔍"],
    [["operations", "change", "configuration"], "⚙️"],
    [["cloud", "saas", "hosting"], "☁️"],
    [["payment", "pci"], "💳"],
    [["endpoint", "device", "byod"], "🖥️"],
  ];
  for (const [keys, icon] of map) if (keys.some(k => d.includes(k))) return icon;
  return "🛡️";
}

// Consistent page header: an icon chip aligned with the topic heading + optional subtitle
function PageHeader({ icon, title, subtitle, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #EDE7FF, #DCD2FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: "0 2px 6px rgba(115,60,242,0.12)" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <h2 style={{ margin: 0, color: "#111625", fontSize: 22 }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

// ─── BRAND STYLING CONFIGURATIONS (AeroGuard Corporate Specs) ─────────────
const C = {
  navy: "#111625",
  navyMid: "#3C4253",
  navyLight: "#6B7280",
  accent: "#733CF2",
  accentHover: "#5F2EEA",
  brandGreen: "#2CC84A",
  teal: "#0D9488",
  tealLight: "#CCFBF1",
  amber: "#D97706",
  amberLight: "#FEF3C7",
  rose: "#E11D48",
  roseLight: "#FFE4E6",
  sky: "#0284C7",
  skyLight: "#E0F2FE",
  green: "#16A34A",
  greenLight: "#DCFCE7",
  slate: "#9CA3AF",
  slateLight: "#F8FAFC",
  white: "#FFFFFF",
  border: "#D1D5DB"
};

const statusConfig = {
  "Not yet started": { bg: "#F1F5F9", color: "#475569" },
  "Triggered": { bg: "#E0F2FE", color: "#0369A1" },
  "In Progress": { bg: "#FEF3C7", color: "#92400E" },
  "Under Audit Review": { bg: "#E0F2FE", color: "#0284C7" },
  "Action Required": { bg: "#FFE4E6", color: "#E11D48" },
  "Verified": { bg: "#DCFCE7", color: "#16A34A" },
  "Closed": { bg: "#DCFCE7", color: "#15803D" }
};

// ─── Yes/No/NA choice styling ───
const choiceConfig = {
  "Yes": { bg: "#DCFCE7", color: "#15803D" },
  "No": { bg: "#FFE4E6", color: "#E11D48" },
  "NA": { bg: "#F1F5F9", color: "#475569" },
};
function ChoiceBadge({ value }) {
  if (!value) return <span style={{ color: "#9CA3AF" }}>—</span>;
  const s = choiceConfig[value] || {};
  return <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, ...s }}>{value}</span>;
}

// ─── AI RISK LEVEL STYLING ───
const riskConfig = {
  "Low": { bg: "#DCFCE7", color: "#15803D" },
  "Medium": { bg: "#FEF3C7", color: "#92400E" },
  "High": { bg: "#FFE4E6", color: "#9F1239" },
  "Critical": { bg: "#7F1D1D", color: "#FFFFFF" }
};

const tierConfig = {
  "P0": { bg: "#FFE4E6", color: "#9F1239" },
  "P1": { bg: "#FEF3C7", color: "#92400E" },
  "P2": { bg: "#F1F5F9", color: "#334155" },
  "N/A": { bg: "transparent", color: "#94A3B8" }
};

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <AuthGate onAuthenticated={(authenticatedUser) => setUser(authenticatedUser)} />;
  }

  return <PortalMain userInfo={user} onLogout={() => setUser(null)} />;
}

/* ─── AUTH GATE CONTAINER ─── */
function AuthGate({ onAuthenticated }) {
  const [state, setState] = useState("login");
  const [userContext, setUserContext] = useState(null);

  if (state === "login") {
    return (
      <LoginScreen
        onSuccess={(u) => {
          setUserContext(u); // This securely saves the { email } you typed in!
          setState("mfa");
        }}
        onForgot={() => setState("forgot")}
      />
    );
  }

  if (state === "forgot") {
    return <ForgotPasswordScreen onBack={() => setState("login")} />;
  }

  if (state === "mfa") {
    return (
      <MFAScreen
        userInfo={userContext}
        onSuccess={(res) => {
          // Combine the user information together cleanly
          const updatedContext = { ...userContext, ...res.user };
          setUserContext(updatedContext);

          if (res.user.isFirstLogin) {
            setState("force"); // Sends them to change password if it's their first time
          } else {
            onAuthenticated(updatedContext);
          }
        }}
      />
    );
  }

  if (state === "force") {
    return (
      <ForceChangePasswordScreen
        userInfo={userContext} // Safely forwards the verified email down
        onSuccess={(res) => {
          onAuthenticated({ ...userContext, ...res.user, isFirstLogin: false });
        }}
      />
    );
  }
}

/* ─── Branded two-panel auth shell (AeroGuard theme) ─── */
const authInput = {
  width: "100%", padding: "12px 14px", marginBottom: 16, boxSizing: "border-box",
  borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, outline: "none",
};
const authBtn = {
  width: "100%", background: C.accent, color: "white", border: "none",
  padding: 13, borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 15,
};
function AuthShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", padding: 24, fontFamily: "system-ui, -apple-system, sans-serif", background: "radial-gradient(1100px 560px at 50% -8%, #EDE7FF 0%, #F6F4FF 45%, #F8FAFC 100%)" }}>
      <div style={{ width: 420, background: "white", padding: "38px 40px 34px", borderRadius: 20, boxShadow: "0 24px 70px rgba(115,60,242,0.14)", border: "1px solid #EFEAFE" }}>
        {/* accent bar */}
        <div style={{ height: 4, width: 56, borderRadius: 4, background: `linear-gradient(90deg, ${C.accent}, ${C.brandGreen})`, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><Logo height={34} /></div>
        <div style={{ textAlign: "center", color: C.navyLight, fontSize: 12, letterSpacing: 0.6, marginBottom: 26, textTransform: "uppercase" }}>Risk &amp; Compliance Platform</div>
        {children}
        <ShiprocketBanner variant="auth" />
      </div>
    </div>
  );
}

function LoginScreen({ onSuccess, onForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", { email: email.trim(), password });
      if (res.data.status === "mfa_required" || res.data.mfaRequired) {
        onSuccess({ email: email.trim() });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password.");
    }
  };

  return (
    <AuthShell>
      <h2 style={{ color: C.navy, margin: "0 0 4px 0", textAlign: "center" }}>Welcome back</h2>
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 26, textAlign: "center" }}>Sign in to AeroGuard</p>
      {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 14, background: C.roseLight, padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
      <form onSubmit={handleLogin}>
        <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Corporate Email</label>
        <input type="email" placeholder="you@aeroguard.com" value={email} onChange={e => setEmail(e.target.value)} style={{ ...authInput, marginTop: 6 }} required />
        <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Password</label>
        <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} style={{ ...authInput, marginTop: 6, marginBottom: 10 }} required />
        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <span onClick={onForgot} style={{ color: C.accent, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Forgot password?</span>
        </div>
        <button type="submit" style={authBtn}>Sign In</button>
      </form>
    </AuthShell>
  );
}

function ForgotPasswordScreen({ onBack }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("without");   // "with" | "without" last password
  const [email, setEmail] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [mailOtp, setMailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const requestOtp = async (e) => {
    e.preventDefault(); setError("");
    try {
      const res = await axios.post("http://localhost:5000/api/auth/request-otp", { email: email.trim(), mode: "both" });
      setInfo(res.data.devOtps ? `DEV: mail OTP ${res.data.devOtps.mail}, mobile OTP ${res.data.devOtps.mobile}` : "OTPs sent to your registered email and mobile.");
      setStep(2);
    } catch (err) { setError(err.response?.data?.detail || "Could not send OTP."); }
  };
  const reset = async (e) => {
    e.preventDefault(); setError("");
    try {
      const body = { email: email.trim(), mailOtp: mailOtp.trim(), mobileOtp: mobileOtp.trim(), newPassword: newPw };
      if (mode === "with") body.oldPassword = oldPw;
      await axios.post("http://localhost:5000/api/auth/forgot-password", body);
      alert("Password reset successfully. Please sign in."); onBack();
    } catch (err) { setError(err.response?.data?.detail || "Reset failed."); }
  };

  const modeBtn = (m, label) => (
    <button type="button" onClick={() => setMode(m)} style={{ flex: 1, padding: "9px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${mode === m ? C.accent : C.border}`, background: mode === m ? C.accent : "white", color: mode === m ? "white" : C.navyMid }}>{label}</button>
  );

  return (
    <AuthShell>
      <h2 style={{ color: C.navy, margin: "0 0 4px 0", textAlign: "center" }}>Reset your password</h2>
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 22, textAlign: "center" }}>Verify with OTPs sent to your email <b>and</b> mobile (both required)</p>
      {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 12, background: C.roseLight, padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
      {info && <div style={{ color: C.teal, fontSize: 12, marginBottom: 12, background: C.tealLight, padding: "8px 12px", borderRadius: 6 }}>{info}</div>}
      {step === 1 ? (
        <form onSubmit={requestOtp}>
          <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Registered Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...authInput, marginTop: 6, marginBottom: 20 }} required />
          <button type="submit" style={authBtn}>Send OTP</button>
        </form>
      ) : (
        <form onSubmit={reset}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {modeBtn("with", "I know my current password")}
            {modeBtn("without", "I don't know it")}
          </div>
          {mode === "with" && (
            <>
              <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Current Password</label>
              <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} maxLength={128} style={{ ...authInput, marginTop: 6 }} required />
            </>
          )}
          <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Email OTP</label>
          <input type="text" inputMode="numeric" maxLength={6} value={mailOtp} onChange={e => setMailOtp(e.target.value.replace(/\D/g, ""))} style={{ ...authInput, marginTop: 6 }} required />
          <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Mobile OTP</label>
          <input type="text" inputMode="numeric" maxLength={6} value={mobileOtp} onChange={e => setMobileOtp(e.target.value.replace(/\D/g, ""))} style={{ ...authInput, marginTop: 6 }} required />
          <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>New Password</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*\d).{8,128}" title="At least 8 characters, letters and numbers" style={{ ...authInput, marginTop: 6, marginBottom: 20 }} required />
          <button type="submit" style={authBtn}>Reset Password</button>
        </form>
      )}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <span onClick={onBack} style={{ color: C.accent, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>← Back to sign in</span>
      </div>
    </AuthShell>
  );
}

function MFAScreen({ userInfo, onSuccess }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const verify = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5000/api/auth/verify-mfa", { email: userInfo.email, code });
      onSuccess(res.data);
    } catch (err) { setError("MFA verification failed. Try again."); }
  };

  return (
    <AuthShell>
      <h2 style={{ color: C.navy, margin: "0 0 4px 0", textAlign: "center" }}>Secure identity check</h2>
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 22 }}>Enter the 6-digit verification code <b>(123456)</b></p>
      {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 14, background: C.roseLight, padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
      <form onSubmit={verify}>
        <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} title="Enter the 6-digit numeric code" placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} style={{ ...authInput, textAlign: "center", letterSpacing: 8, fontWeight: 800, fontSize: 22, marginBottom: 22 }} required />
        <button type="submit" style={{ ...authBtn, background: C.brandGreen }}>Verify Code</button>
      </form>
    </AuthShell>
  );
}

function ForceChangePasswordScreen({ userInfo, onSuccess }) {
  const [newPw, setNewPw] = useState("");
  const [error, setError] = useState("");

  const executeMutation = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5000/api/auth/change-password", { email: userInfo.email, newPassword: newPw });
      onSuccess(res.data);
    } catch { setError("Could not update password. Try again."); }
  };

  return (
    <AuthShell>
      <h2 style={{ color: C.navy, margin: "0 0 4px 0", textAlign: "center" }}>Set your password</h2>
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 22 }}>First-time login — please choose a new password</p>
      {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 14, background: C.roseLight, padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
      <form onSubmit={executeMutation}>
        <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>New Password</label>
        <input type="password" placeholder="At least 8 chars, letters & numbers" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*\d).{8,128}" title="At least 8 characters, including letters and numbers" style={{ ...authInput, marginTop: 6, marginBottom: 22 }} required />
        <button type="submit" style={authBtn}>Set Password &amp; Continue</button>
      </form>
    </AuthShell>
  );
}

/* ─── MAIN PORTAL SHELL & SIDEBAR ROUTER ─── */
const NAV_BY_ROLE = {
  admin: [
    { id: "dashboard", label: "📊 Execution Overview" },
    { id: "user_mgmt", label: "👥 Internal User Management" },
    { id: "vendor_mgmt", label: "🏢 Vendor Management" },
    { id: "questionnaire_mgmt", label: "📝 Questionnaire Management" },
    { id: "review", label: "🛡️ Review & Reports" },
    { id: "soc_audit", label: "🔐 SOC 2 Audit" },
  ],
  internal_auditor: [
    { id: "view_questions", label: "📝 View Questionnaire" },
    { id: "trigger", label: "📤 TPRM Audit" },
    { id: "fill_audit", label: "🧾 Seller Audit" },
    { id: "review", label: "🛡️ Review Responses" },
    { id: "soc_audit", label: "🔐 SOC 2 Audit" },
  ],
  vendor: [
    { id: "my_questionnaire", label: "📝 My Assessment" },
    { id: "certifications", label: "🔐 Security Certifications" },
    { id: "vendor_details", label: "🏢 Vendor Details" },
  ],
  stakeholder: [
    { id: "soc_controls", label: "📋 My SOC 2 Controls" },
  ],
};

/* ─── In-app notification bell (admins & auditors) ─── */
function NotificationBell({ userInfo }) {
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  const load = () => axios
    .get(`http://localhost:5000/api/notifications?email=${encodeURIComponent(userInfo.email)}`)
    .then(r => setNotes(r.data))
    .catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // poll every 20s
    return () => clearInterval(t);
  }, [userInfo.email]);

  // Close the dropdown on outside click, window blur, or tab switch.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onBlur = () => setOpen(false);
    const onVis = () => { if (document.hidden) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [open]);

  const unread = notes.filter(n => !n.isRead).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      const fd = new FormData(); fd.append("email", userInfo.email);
      try { await axios.post("http://localhost:5000/api/notifications/mark-read", fd); } catch {}
      setNotes(notes.map(n => ({ ...n, isRead: true })));
    }
  };

  const fmt = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return ""; } };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={toggle} title="Notifications" style={{ position: "relative", background: "transparent", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>
        🔔
        {unread > 0 && (
          <span style={{ position: "absolute", top: -6, right: -8, background: C.rose, color: "white", borderRadius: 10, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 34, width: 320, maxHeight: 380, overflowY: "auto", background: "white", border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.slateLight}`, fontWeight: 700, color: C.navy, fontSize: 13 }}>Notifications</div>
          {notes.length === 0 && <div style={{ padding: 16, color: C.navyLight, fontSize: 13 }}>No notifications.</div>}
          {notes.map(n => (
            <div key={n.id} style={{ padding: "10px 14px", borderBottom: `1px solid ${C.slateLight}`, background: n.isRead ? "white" : "#F4F2FF" }}>
              <div style={{ fontSize: 13, color: C.navyMid }}>{n.message}</div>
              <div style={{ fontSize: 11, color: C.navyLight, marginTop: 4 }}>{fmt(n.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PortalMain({ userInfo, onLogout }) {
  const nav = NAV_BY_ROLE[userInfo.role] || NAV_BY_ROLE.vendor;
  const [activeTab, setActiveTab] = useState(nav[0].id);
  const [auditor, setAuditor] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);

  useEffect(() => {
    if (userInfo.role === "vendor") {
      axios.get(`http://localhost:5000/api/vendor/state?email=${encodeURIComponent(userInfo.email)}`)
        .then(r => setAuditor(r.data.auditor || null)).catch(() => {});
    }
  }, [userInfo.role, userInfo.email]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
      {/* SIDEBAR CONTROL BAR */}
      <div style={{ width: 260, background: "linear-gradient(180deg, #8B6BF7 0%, #733CF2 50%, #5B2FD6 100%)", color: "white", display: "flex", flexDirection: "column", padding: "24px 16px", overflowY: "auto" }}>
        <div style={{ background: "white", borderRadius: 10, padding: "12px", margin: "0 6px 6px 6px", display: "flex", justifyContent: "center" }}>
          <Logo height={26} />
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", textAlign: "center", letterSpacing: 2, marginTop: 6, marginBottom: 22 }}>RISK & COMPLIANCE PLATFORM</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", paddingLeft: 12, marginBottom: 10, textTransform: "uppercase" }}>Navigation</div>

        {nav.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ width: "100%", textAlign: "left", padding: "12px", background: activeTab === item.id ? "rgba(255,255,255,0.22)" : "transparent", border: "none", color: "white", borderRadius: 6, cursor: "pointer", marginBottom: 6, fontWeight: activeTab === item.id ? 700 : 400 }}>{item.label}</button>
        ))}

        {/* Auditor who triggered this assessment (vendor sidebar) */}
        {userInfo.role === "vendor" && auditor && (auditor.name || auditor.email) && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Triggered by (Auditor)</div>
            {auditor.name && <div style={{ fontSize: 13, fontWeight: 700 }}>{auditor.name}</div>}
            {auditor.email && <div style={{ fontSize: 11, wordBreak: "break-all" }}><a href={`mailto:${auditor.email}`} style={{ color: "white", textDecoration: "none" }}>✉ {auditor.email}</a></div>}
            {auditor.mobile && <div style={{ fontSize: 11, marginTop: 2 }}>📱 {auditor.mobile}</div>}
          </div>
        )}

        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 16, paddingLeft: 12 }}>
          <div style={{ fontSize: 13, fontWeight: "bold" }}>{userInfo.name || "Operator"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>Role: {userInfo.role}</div>
          <button onClick={() => setShowChangePw(true)} style={{ width: "100%", padding: "8px", background: "rgba(255,255,255,0.18)", border: "none", color: "white", borderRadius: 4, cursor: "pointer", marginBottom: 8, fontSize: 13 }}>🔑 Change Password</button>
          <button onClick={onLogout} style={{ width: "100%", padding: "8px", background: C.rose, border: "none", color: "white", borderRadius: 4, cursor: "pointer" }}>Sign Out</button>
        </div>
      </div>

      {/* CONTENT REGION CONTAINER */}
      <div style={{ flex: 1, backgroundColor: C.slateLight, padding: "0 40px 40px 40px", overflowY: "auto" }}>
        {/* IDENTITY HEADER BAR — Shiprocket banner + notifications + name + role */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 20px", marginTop: 40, marginBottom: 24 }}>
          <ShiprocketBanner variant="topbar" />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {userInfo.role !== "vendor" && <NotificationBell userInfo={userInfo} />}
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {(userInfo.name || "U").charAt(0).toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontWeight: 700, color: C.navy }}>{userInfo.name || "Operator"}</div>
              <div style={{ fontSize: 12, color: C.navyLight }}>
                Role: <b style={{ textTransform: "capitalize", color: C.navyMid }}>{userInfo.role}</b>
              </div>
            </div>
          </div>
        </div>

        {activeTab === "dashboard" && <AdminOverviewDashboard />}
        {activeTab === "user_mgmt" && <InternalUserManagement currentUser={userInfo} />}
        {activeTab === "vendor_mgmt" && <VendorRegistryLifecycle />}
        {activeTab === "questionnaire_mgmt" && <QuestionnaireManagement currentUser={userInfo} />}
        {activeTab === "view_questions" && <QuestionViewer currentUser={userInfo} />}
        {activeTab === "trigger" && <AuditorTrigger userInfo={userInfo} />}
        {activeTab === "fill_audit" && <FillSellerAudit />}
        {activeTab === "review" && <ReviewResponses />}
        {activeTab === "soc_audit" && <SocAudit userInfo={userInfo} />}
        {activeTab === "soc_controls" && <StakeholderDashboard userInfo={userInfo} />}
        {activeTab === "my_questionnaire" && <VendorQuestionnaire userInfo={userInfo} />}
        {activeTab === "certifications" && <VendorCertifications userInfo={userInfo} />}
        {activeTab === "vendor_details" && <VendorDetails userInfo={userInfo} />}
      </div>
      {showChangePw && <ChangePasswordModal userInfo={userInfo} onClose={() => setShowChangePw(false)} />}
    </div>
  );
}

/* ─── Change password (knows current password) with OTP ─── */
function ChangePasswordModal({ userInfo, onClose }) {
  const [step, setStep] = useState(1);
  const [oldPw, setOldPw] = useState("");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const requestOtp = async (e) => {
    e.preventDefault(); setError("");
    if (!oldPw) { setError("Enter your current password."); return; }
    try {
      const res = await axios.post("http://localhost:5000/api/auth/request-otp", { email: userInfo.email, mode: "single" });
      setInfo(res.data.devOtps ? `DEV OTPs — mail: ${res.data.devOtps.mail}, mobile: ${res.data.devOtps.mobile} (use either)` : "OTP sent to your email and mobile — enter either one.");
      setStep(2);
    } catch (err) { setError(err.response?.data?.detail || "Could not send OTP."); }
  };
  const submit = async (e) => {
    e.preventDefault(); setError("");
    try {
      await axios.post("http://localhost:5000/api/auth/change-password-secure", { email: userInfo.email, oldPassword: oldPw, otp: otp.trim(), newPassword: newPw });
      alert("Password changed successfully."); onClose();
    } catch (err) { setError(err.response?.data?.detail || "Change failed."); }
  };

  const inp = { width: "100%", padding: 10, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 6, marginBottom: 14 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 70, padding: 20 }}>
      <div style={{ background: "white", borderRadius: 10, width: 400, padding: 28 }}>
        <h3 style={{ margin: "0 0 4px 0", color: C.navy }}>Change Password</h3>
        <p style={{ fontSize: 12, color: C.navyLight, marginBottom: 16 }}>Verify with your current password and an OTP.</p>
        {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 12, background: C.roseLight, padding: "8px 12px", borderRadius: 6 }}>{error}</div>}
        {info && <div style={{ color: C.teal, fontSize: 12, marginBottom: 12, background: C.tealLight, padding: "8px 12px", borderRadius: 6 }}>{info}</div>}
        {step === 1 ? (
          <form onSubmit={requestOtp}>
            <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Current Password</label>
            <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} maxLength={128} style={inp} required />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ padding: "10px 16px", background: "#EEE", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
              <button type="submit" style={{ ...authBtn, width: "auto", padding: "10px 18px" }}>Send OTP</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit}>
            <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>OTP (email or mobile)</label>
            <input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} style={inp} required />
            <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>New Password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} maxLength={128} pattern="(?=.*[A-Za-z])(?=.*\d).{8,128}" title="At least 8 characters, letters and numbers" style={inp} required />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ padding: "10px 16px", background: "#EEE", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
              <button type="submit" style={{ ...authBtn, width: "auto", padding: "10px 18px" }}>Change Password</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── TAB COMPONENTS ─── */
function AdminOverviewDashboard() {
  const [act, setAct] = useState({ activity: [], busyAuditors: 0, totalAssignments: 0 });
  const load = () => axios.get("http://localhost:5000/api/admin/auditor-activity").then(r => setAct(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const fmt = (iso) => { try { return iso ? new Date(iso).toLocaleString() : "—"; } catch { return "—"; } };
  const stat = (label, value, color) => (
    <div style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, color: C.navyLight }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: "bold", marginTop: 4, color: color || C.navy }}>{value}</div>
    </div>
  );

  return (
    <div>
      <PageHeader icon="📊" title="Execution Overview" subtitle="Auditor activity & compliance snapshot" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, margin: "16px 0 28px 0" }}>
        {stat("Busy Auditors", act.busyAuditors, C.accent)}
        {stat("Active Assignments", act.activity.filter(a => a.active).length, C.amber)}
        {stat("Total Assignments", act.totalAssignments, C.green)}
      </div>

      <h4 style={{ marginBottom: 10 }}>🛡️ Auditor Activity — who is handling which vendor</h4>
      <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden", marginBottom: 30 }}>
        <thead>
          <tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
            <th style={{ padding: 12 }}>Auditor</th><th style={{ padding: 12 }}>Vendor / Task</th>
            <th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Triggered At</th>
          </tr>
        </thead>
        <tbody>
          {act.activity.length === 0 && <tr><td colSpan={4} style={{ padding: 14, color: C.navyLight }}>No questionnaires have been triggered yet.</td></tr>}
          {act.activity.map((a, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: a.active ? "white" : C.slateLight }}>
              <td style={{ padding: 12 }}>{a.active && <span title="Busy" style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: C.green, marginRight: 6 }} />}<b>{a.auditorName || a.auditorEmail}</b><br /><span style={{ fontSize: 11, color: C.navyLight }}>{a.auditorEmail}</span></td>
              <td style={{ padding: 12 }}>{a.vendor}<br /><span style={{ fontSize: 11, color: C.navyLight }}>{a.vendorEmail}</span></td>
              <td style={{ padding: 12 }}><span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, ...statusConfig[a.status] }}>{a.status}</span></td>
              <td style={{ padding: 12, fontSize: 13, color: C.navyMid }}>{fmt(a.assignedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <AdminVendorUpload onUploadSuccess={() => {}} />
        <QuestionBankUpload onUploadSuccess={() => {}} />
      </div>
    </div>
  );
}

function AdminVendorUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const handleUpload = async () => {
    if(!file) return;
    const fd = new FormData(); fd.append("file", file);
    await axios.post("http://localhost:5000/api/admin/upload-vendors-xlsx", fd);
    alert("Vendor directory synchronized."); if(onUploadSuccess) onUploadSuccess();
  };
  return (
    <div style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <h4>Bulk Replace Vendor Blueprint Registry</h4>
      <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files[0])} style={{ margin: "10px 0" }} />
      <button onClick={handleUpload} style={{ display:"block", background: C.accent, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer" }}>Upload .xlsx File</button>
    </div>
  );
}

function QuestionBankUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const handleUpload = async () => {
    if(!file) { alert("Please choose a .xlsx file first."); return; }
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await axios.post("http://localhost:5000/api/admin/upload-questions-xlsx", fd);
      alert(res.data.message || "Questions loaded.");
      setFile(null);
      if(onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    }
  };
  return (
    <div style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <h4 style={{ marginTop: 0 }}>Upload Questionnaire + Answer Key</h4>
      <p style={{ fontSize: 12, color: C.navyLight, margin: "0 0 6px 0" }}>
        .xlsx columns: <b>Question Text</b>, <b>Domain</b>, and optional <b>Answer</b> (the reference answer used for AI scoring &amp; SR Seller Audit).
      </p>
      <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files[0])} style={{ margin: "10px 0" }} />
      <button onClick={handleUpload} style={{ display:"block", background: C.accent, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer" }}>Upload Questionnaire + Answer Key (.xlsx)</button>
    </div>
  );
}

function InternalUserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("internal_auditor");

  const syncUsers = async () => {
    const res = await axios.get("http://localhost:5000/api/admin/users/");
    setUsers(res.data);
  };
  useEffect(() => { syncUsers(); }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/admin/users/", { email, name, mobile, role, companyName: "AeroGuard Internal" });
      setEmail(""); setName(""); setMobile(""); syncUsers();
    } catch (err) { alert(err.response?.data?.detail || "Error provisioning user."); }
  };

  const handleToggleSuspend = async (u) => {
    const next = !u.isSuspended;
    if (!window.confirm(`${next ? "Suspend" : "Reactivate"} ${u.name} (#${u.id})?`)) return;
    try {
      await axios.post(`http://localhost:5000/api/admin/users/${u.id}/suspend?suspended=${next}`);
      syncUsers();
    } catch (err) { alert(err.response?.data?.detail || "Error updating user status."); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete ${u.name} (#${u.id})? This cannot be undone.`)) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/users/${u.id}`);
      syncUsers();
    } catch (err) { alert(err.response?.data?.detail || "Error deleting user."); }
  };

  return (
    <div>
      <PageHeader icon="👥" title="Internal User Management" subtitle="Provision, suspend or remove internal users" />
      <form onSubmit={handleCreateUser} style={{ background: "white", padding: 24, borderRadius: 8, marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={120} style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }} required />
        </div>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Corporate Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }} required />
        </div>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Mobile <span style={{ color: C.slate }}>(optional)</span></label>
          <input type="text" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91…" maxLength={30} pattern="[0-9+\-()\s]{7,30}" title="Digits and + - ( ) only" style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>System Role Mapping</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            <option value="internal_auditor">Internal Auditor</option>
            <option value="admin">Platform Admin</option>
          </select>
        </div>
        <button type="submit" style={{ background: C.accent, color: "white", padding: "10px 20px", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>Provision Identity</button>
      </form>

      <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
            <th style={{ padding: 12 }}>User ID</th>
            <th style={{ padding: 12 }}>Name</th>
            <th style={{ padding: 12 }}>Email Context</th>
            <th style={{ padding: 12 }}>Mobile</th>
            <th style={{ padding: 12 }}>Role Profile Tag</th>
            <th style={{ padding: 12 }}>Status</th>
            <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const isSelf = currentUser && u.id === currentUser.id;
            return (
            <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: u.isSuspended ? 0.6 : 1 }}>
              <td style={{ padding: 12, fontWeight: 600, color: C.navyMid }}>#{u.id}</td>
              <td style={{ padding: 12 }}>{u.name}{isSelf && <span style={{ marginLeft: 6, fontSize: 10, color: C.accent, fontWeight: 700 }}>(you)</span>}</td>
              <td style={{ padding: 12 }}>{u.email}</td>
              <td style={{ padding: 12, color: u.mobile ? C.navyMid : C.slate }}>{u.mobile || "—"}</td>
              <td style={{ padding: 12 }}><span style={{ textTransform: "capitalize", background: C.skyLight, color: C.sky, padding: "3px 8px", borderRadius: 4, fontSize: 12 }}>{u.role}</span></td>
              <td style={{ padding: 12 }}>
                {u.isSuspended
                  ? <span style={{ background: C.roseLight, color: C.rose, padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Suspended</span>
                  : <span style={{ background: C.greenLight, color: C.green, padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Active</span>}
              </td>
              <td style={{ padding: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                <button
                  onClick={() => handleToggleSuspend(u)}
                  disabled={isSelf}
                  title={isSelf ? "You cannot suspend your own account" : ""}
                  style={{ background: u.isSuspended ? C.teal : C.amber, color: "white", border: "none", padding: "6px 12px", borderRadius: 4, marginRight: 8, cursor: isSelf ? "not-allowed" : "pointer", opacity: isSelf ? 0.4 : 1, fontSize: 13 }}>
                  {u.isSuspended ? "Reactivate" : "Suspend"}
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={isSelf}
                  title={isSelf ? "You cannot delete your own account" : ""}
                  style={{ background: C.rose, color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: isSelf ? "not-allowed" : "pointer", opacity: isSelf ? 0.4 : 1, fontSize: 13 }}>
                  Delete
                </button>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

function VendorRegistryLifecycle() {
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [panel, setPanel] = useState(null); // null | "add" | "upload"
  const [vEmail, setVEmail] = useState("");
  const [vCompany, setVCompany] = useState("");

  const loadVendors = async () => {
    const res = await axios.get("http://localhost:5000/api/admin/vendors");
    setVendors(res.data);
  };
  useEffect(() => { loadVendors(); }, []);

  const handleAudit = async (vendorId, action) => {
    const fd = new FormData(); fd.append("vendorId", vendorId); fd.append("action", action); fd.append("comments", comment);
    await axios.post("http://localhost:5000/api/admin/audit-action", fd);
    setSelected(null); setComment(""); loadVendors();
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/admin/vendors", { email: vEmail.trim(), companyName: vCompany.trim() });
      setVEmail(""); setVCompany(""); setPanel(null); loadVendors();
    } catch (err) { alert(err.response?.data?.detail || "Error adding vendor."); }
  };

  const toggleVendor = async (v) => {
    const next = !v.isSuspended;
    if (!window.confirm(`${next ? "Disable" : "Enable"} vendor ${v.companyName}? ${next ? "They won't be able to log in." : ""}`)) return;
    try {
      await axios.post(`http://localhost:5000/api/admin/users/${v.id}/suspend?suspended=${next}`);
      loadVendors();
    } catch (err) { alert(err.response?.data?.detail || "Error updating vendor."); }
  };

  const tabBtn = (active) => ({
    background: active ? C.accent : "white", color: active ? "white" : C.navy,
    border: `1px solid ${active ? C.accent : C.border}`, padding: "10px 18px",
    borderRadius: 6, cursor: "pointer", fontWeight: 600, marginRight: 12,
  });

  return (
    <div>
      <PageHeader icon="🏢" title="Vendor Management" subtitle="Add, enable/disable and audit vendors" />

      {/* ── ADMIN ACTIONS: add single vendor / bulk upload ── */}
      <div style={{ display: "flex", margin: "16px 0 8px 0" }}>
        <button style={tabBtn(panel === "add")} onClick={() => setPanel(panel === "add" ? null : "add")}>➕ Add New Vendor</button>
        <button style={tabBtn(panel === "upload")} onClick={() => setPanel(panel === "upload" ? null : "upload")}>⬆️ Upload Vendor List</button>
      </div>

      {panel === "add" && (
        <form onSubmit={handleAddVendor} style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 24, display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Company Name</label>
            <input type="text" value={vCompany} onChange={e => setVCompany(e.target.value)} maxLength={120} style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }} required />
          </div>
          <div>
            <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Vendor Email</label>
            <input type="email" value={vEmail} onChange={e => setVEmail(e.target.value)} style={{ padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }} required />
          </div>
          <button type="submit" style={{ background: C.accent, color: "white", padding: "10px 20px", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>Create Vendor</button>
        </form>
      )}

      {panel === "upload" && (
        <div style={{ marginBottom: 24 }}>
          <AdminVendorUpload onUploadSuccess={() => { setPanel(null); loadVendors(); }} />
        </div>
      )}

      <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
            <th style={{ padding: 14 }}>Vendor Identity Profile</th>
            <th style={{ padding: 14 }}>Score</th>
            <th style={{ padding: 14 }}>AI Risk</th>
            <th style={{ padding: 14 }}>Status Evaluation</th>
            <th style={{ padding: 14, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map(v => (
            <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: 14 }}><b>{v.companyName || v.name}</b><br/><span style={{ fontSize: 12, color: C.navyLight }}>{v.email}</span></td>
              <td style={{ padding: 14 }}><span style={{ fontWeight: "bold" }}>{v.vendorScore || 0}%</span></td>
              <td style={{ padding: 14 }}>
                {v.aiRiskSummary
                  ? <span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, ...(riskConfig[v.aiRiskSummary.risk_level] || {}) }}>{v.aiRiskSummary.risk_level}</span>
                  : <span style={{ fontSize: 12, color: C.slate }}>—</span>}
              </td>
              <td style={{ padding: 14 }}>
                <span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, ...statusConfig[v.tprmStatus] }}>{v.tprmStatus}</span>
                {v.isSuspended && <span style={{ marginLeft: 6, padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: C.roseLight, color: C.rose }}>Disabled</span>}
              </td>
              <td style={{ padding: 14, textAlign: "right", whiteSpace: "nowrap" }}>
                <button onClick={() => toggleVendor(v)} style={{ background: v.isSuspended ? C.teal : C.amber, color: "white", border: "none", padding: "6px 12px", borderRadius: 4, marginRight: 8, cursor: "pointer", fontSize: 13 }}>{v.isSuspended ? "Enable" : "Disable"}</button>
                <button onClick={() => setSelected(v)} style={{ background: C.accent, color: "white", border: "none", padding: "6px 12px", borderRadius: 4, marginRight: 8, cursor: "pointer" }}>Audit Dossier</button>
                <a href={`http://localhost:5000/api/admin/export-report/${v.id}`} target="_blank" style={{ background: C.navy, color: "white", padding: "6px 12px", textDecoration: "none", borderRadius: 4, fontSize: 13 }}>Export PDF</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "white", padding: 32, borderRadius: 8, width: 540, maxHeight: "85vh", overflowY: "auto" }}>
            <h3>Verify Dossier Parameters: {selected.companyName || selected.name}</h3>

            {/* ── AI RISK ASSESSMENT PANEL ── */}
            {selected.aiRiskSummary && (
              <div style={{ background: C.slateLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, margin: "12px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>🤖 AI Risk Assessment</span>
                  <span style={{ padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, ...(riskConfig[selected.aiRiskSummary.risk_level] || {}) }}>{selected.aiRiskSummary.risk_level}</span>
                </div>
                <p style={{ fontSize: 13, color: C.navyMid, margin: "0 0 10px 0" }}>{selected.aiRiskSummary.summary}</p>
                {selected.aiRiskSummary.key_concerns?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 4 }}>Key Concerns</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.navyMid }}>
                      {selected.aiRiskSummary.key_concerns.map((concern, i) => <li key={i}>{concern}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ fontSize: 13, color: C.navyMid }}>
                  <b>Recommendation:</b> {selected.aiRiskSummary.recommendation}
                </div>
              </div>
            )}

            <p style={{ fontSize: 13, color: C.navyMid }}>Review responses and input compliance judgment tracking status rules:</p>
            <textarea placeholder="Audit annotation review comments..." value={comment} onChange={e => setComment(e.target.value)} style={{ width: "100%", height: 100, padding: 10, margin: "12px 0", boxSizing:"border-box" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setSelected(null)} style={{ padding: "8px 16px", background: "#EEE", border: "none" }}>Cancel</button>
              <button onClick={() => handleAudit(selected.id, "reject")} style={{ padding: "8px 16px", background: C.rose, color: "white", border: "none", cursor: "pointer" }}>Flag Deficit</button>
              <button onClick={() => handleAudit(selected.id, "approve")} style={{ padding: "8px 16px", background: C.teal, color: "white", border: "none", cursor: "pointer" }}>Approve Pass</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SHARED: answer-key bank, categories as expandable buttons + inline edit ─── */
function QuestionList({ questions, showAnswers, currentUser, frozen, onChanged }) {
  const [open, setOpen] = useState({});         // domain -> expanded
  const [editing, setEditing] = useState(null); // question id being edited
  const [draft, setDraft] = useState({ choice: "", response: "" });

  if (!questions.length) {
    return <p style={{ color: C.navyLight }}>No questions loaded yet. An admin can add or bulk-upload questions.</p>;
  }
  const groups = {};
  questions.forEach(q => { (groups[q.domain] = groups[q.domain] || []).push(q); });
  const domains = Object.keys(groups).sort();
  const th = { padding: "8px 12px", textAlign: "left", fontSize: 12 };
  const td = { padding: "10px 12px", fontSize: 13, verticalAlign: "top", borderTop: `1px solid ${C.slateLight}` };

  const role = currentUser?.role;
  const canEdit = showAnswers && (role === "admin" || (role === "internal_auditor" && !frozen));

  const startEdit = (q) => { setEditing(q.id); setDraft({ text: q.text || "", domain: q.domain || "", choice: q.referenceChoice || "", response: q.referenceAnswer || "" }); };
  const save = async (q) => {
    const fd = new FormData();
    fd.append("role", role || ""); fd.append("text", draft.text || ""); fd.append("domain", draft.domain || "");
    fd.append("choice", draft.choice); fd.append("response", draft.response);
    try {
      await axios.post(`http://localhost:5000/api/admin/questions/${q.id}/edit`, fd);
      setEditing(null); onChanged && onChanged();
    } catch (err) { alert(err.response?.data?.detail || "Edit failed."); }
  };
  const remove = async (q) => {
    if (!window.confirm(`Delete question ${q.id}?\n\n"${q.text}"`)) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/questions/${q.id}?role=${role || ""}`);
      onChanged && onChanged();
    } catch (err) { alert(err.response?.data?.detail || "Delete failed."); }
  };

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #8B6BF7, #6B2FE8)", color: "white", borderRadius: 10, padding: "10px 18px", marginBottom: 14, fontWeight: 700, display: "inline-block", boxShadow: "0 4px 14px rgba(115,60,242,0.25)" }}>
        📋 Total Questions: {questions.length}
      </div>
      {frozen && <div style={{ background: C.skyLight, color: C.sky, padding: "8px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>🔒 Question bank is frozen{role === "admin" ? " — you can still edit as admin." : " — editing is locked for auditors."}</div>}

      {domains.map(domain => {
        const isOpen = !!open[domain];
        return (
          <div key={domain} style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: "white" }}>
            {/* CATEGORY BUTTON */}
            <button onClick={() => setOpen({ ...open, [domain]: !isOpen })}
              style={{ width: "100%", background: isOpen ? "linear-gradient(135deg, #5F2EEA, #4A1FB8)" : "linear-gradient(135deg, #8B6BF7, #6B2FE8)", color: "white", padding: "13px 18px", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 700 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{domainIcon(domain)}</span>
                {domain}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, background: "rgba(255,255,255,0.22)", padding: "3px 12px", borderRadius: 12, fontWeight: 600 }}>{groups[domain].length} questions</span>
                <span style={{ fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </span>
            </button>
            {isOpen && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.slateLight, color: C.navyMid }}>
                    <th style={{ ...th, width: 50 }}>S.No</th>
                    <th style={th}>Assessment Questions</th>
                    {showAnswers && <th style={{ ...th, width: 120 }}>Vendor Response</th>}
                    {showAnswers && <th style={{ ...th, width: "32%" }}>Vendor Remarks</th>}
                    {canEdit && <th style={{ ...th, width: 80 }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {groups[domain].map((q, idx) => editing === q.id ? (
                    <tr key={q.id}>
                      <td style={{ ...td, color: C.slate, fontWeight: 700 }}>{idx + 1}</td>
                      <td style={td}>
                        <textarea value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} style={{ width: "100%", height: 52, padding: 6, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 6 }} />
                        <input value={draft.domain} onChange={e => setDraft({ ...draft, domain: e.target.value })} placeholder="Domain" style={{ width: "100%", padding: 6, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4 }} />
                      </td>
                      <td style={td}>
                        <select value={draft.choice} onChange={e => setDraft({ ...draft, choice: e.target.value })} style={{ padding: 6, borderRadius: 4, border: `1px solid ${C.border}`, width: "100%" }}>
                          <option value="">— select —</option><option value="Yes">Yes</option><option value="No">No</option><option value="NA">NA</option>
                        </select>
                      </td>
                      <td style={td}><textarea value={draft.response} onChange={e => setDraft({ ...draft, response: e.target.value })} style={{ width: "100%", height: 56, padding: 6, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4 }} /></td>
                      <td style={td}>
                        <button onClick={() => save(q)} style={{ background: C.teal, color: "white", border: "none", padding: "5px 10px", borderRadius: 4, cursor: "pointer", marginBottom: 4, width: "100%" }}>Save</button>
                        <button onClick={() => setEditing(null)} style={{ background: "#EEE", border: "none", padding: "5px 10px", borderRadius: 4, cursor: "pointer", width: "100%" }}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={q.id}>
                      <td style={{ ...td, color: C.slate, fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ ...td, fontWeight: 600, color: C.navy }}>{q.text} {q.aiSuggested && <span style={{ fontSize: 10, background: "#EDE9FE", color: C.accent, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>AI</span>}</td>
                      {showAnswers && <td style={td}><ChoiceBadge value={q.referenceChoice} /></td>}
                      {showAnswers && <td style={{ ...td, color: q.referenceAnswer ? C.navyMid : C.slate }}>{q.referenceAnswer || "—"}</td>}
                      {canEdit && <td style={td}>
                        <button onClick={() => startEdit(q)} style={{ background: "white", color: C.accent, border: `1px solid ${C.accent}`, padding: "5px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12, marginBottom: 4, width: "100%" }}>✎ Modify</button>
                        <button onClick={() => remove(q)} style={{ background: "white", color: C.rose, border: `1px solid ${C.rose}`, padding: "5px 8px", borderRadius: 4, cursor: "pointer", fontSize: 12, width: "100%" }}>🗑 Delete</button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── AUDITOR/ADMIN: questionnaire viewer (categories + edit answer-key) ─── */
function QuestionViewer({ currentUser }) {
  const [questions, setQuestions] = useState([]);
  const [frozen, setFrozen] = useState(false);
  const load = () => Promise.all([
    axios.get("http://localhost:5000/api/admin/questions-detail"),
    axios.get("http://localhost:5000/api/admin/questions/freeze-status"),
  ]).then(([q, f]) => { setQuestions(q.data); setFrozen(f.data.frozen); });
  useEffect(() => { load(); }, []);
  const withAnswers = questions.filter(q => q.referenceAnswer || q.referenceChoice).length;
  return (
    <div style={{ maxWidth: 960 }}>
      <PageHeader icon="📝" title="View Questionnaire" subtitle="Browse the question bank by domain" />
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 20 }}>{questions.length} question(s) · {withAnswers} with an answer key. Click a category to expand.</p>
      <QuestionList questions={questions} showAnswers currentUser={currentUser} frozen={frozen} onChanged={load} />
    </div>
  );
}

/* ─── ADMIN: Questionnaire Management (add + bulk upload + list) ─── */
function QuestionnaireManagement({ currentUser }) {
  const [questions, setQuestions] = useState([]);
  const [frozen, setFrozen] = useState(false);
  const [text, setText] = useState("");
  const [domain, setDomain] = useState("General Security");
  const [qChoice, setQChoice] = useState("");
  const [qResponse, setQResponse] = useState("");
  const isAdmin = currentUser?.role === "admin";

  const load = () => Promise.all([
    axios.get("http://localhost:5000/api/admin/questions-detail"),
    axios.get("http://localhost:5000/api/admin/questions/freeze-status"),
  ]).then(([q, f]) => { setQuestions(q.data); setFrozen(f.data.frozen); });
  useEffect(() => { load(); }, []);

  const handleAiAnswer = async () => {
    if (!window.confirm("Use AI to answer all currently-unanswered questions, based on your existing answers?")) return;
    try {
      const res = await axios.post("http://localhost:5000/api/admin/questions/ai-answer");
      alert(res.data.message); load();
    } catch (err) { alert(err.response?.data?.detail || "AI answering failed."); }
  };

  const handleFreeze = async () => {
    const next = !frozen;
    if (!window.confirm(next ? "Freeze the question bank? Internal auditors will no longer be able to edit it." : "Unfreeze the question bank? Internal auditors will be able to edit again.")) return;
    try {
      const fd = new FormData(); fd.append("frozen", next); fd.append("role", currentUser?.role || "");
      await axios.post("http://localhost:5000/api/admin/questions/freeze", fd);
      load();
    } catch (err) { alert(err.response?.data?.detail || "Could not change freeze state."); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/admin/questions", { text, domain, choice: qChoice, response: qResponse });
      setText(""); setQChoice(""); setQResponse(""); load();
    } catch (err) { alert(err.response?.data?.detail || "Error adding question."); }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear ALL questions and reset every vendor's questionnaire? This cannot be undone.")) return;
    try {
      await axios.delete("http://localhost:5000/api/admin/questions");
      load();
    } catch (err) { alert(err.response?.data?.detail || "Error clearing questions."); }
  };

  const handleCategorize = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/admin/questions/categorize");
      const b = res.data.breakdown || {};
      alert(res.data.message + "\n\n" + Object.entries(b).sort((a, c) => c[1] - a[1]).map(([d, n]) => `• ${d}: ${n}`).join("\n"));
      load();
    } catch (err) { alert(err.response?.data?.detail || "Error categorizing."); }
  };

  const handleCleanNoise = async () => {
    if (!window.confirm("Remove rows that aren't actual questions (bare numbers, section headers, enumeration markers)? This deletes those rows.")) return;
    try {
      const res = await axios.post("http://localhost:5000/api/admin/questions/clean-noise");
      alert(res.data.message);
      load();
    } catch (err) { alert(err.response?.data?.detail || "Error cleaning."); }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader icon="📝" title="Questionnaire Management" subtitle="Add, upload, categorize & curate the question bank" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, margin: "16px 0 28px 0" }}>
        {/* Add single question */}
        <form onSubmit={handleAdd} style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <h4 style={{ marginTop: 0 }}>➕ Add New Question</h4>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Question Text</label>
          <textarea value={text} onChange={e => setText(e.target.value)} required maxLength={8000} style={{ width: "100%", height: 70, padding: 10, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }} />
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Domain</label>
          <input type="text" value={domain} onChange={e => setDomain(e.target.value)} maxLength={120} style={{ width: "100%", padding: 10, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }} />
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Vendor Response (answer key)</label>
          <select value={qChoice} onChange={e => setQChoice(e.target.value)} style={{ width: "100%", padding: 10, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }}>
            <option value="">— Yes/No/NA —</option><option value="Yes">Yes</option><option value="No">No</option><option value="NA">NA</option>
          </select>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Vendor Remark (expected response, for AI sensing)</label>
          <textarea value={qResponse} onChange={e => setQResponse(e.target.value)} maxLength={8000} style={{ width: "100%", height: 56, padding: 10, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }} />
          <button type="submit" style={{ background: C.accent, color: "white", padding: "10px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Add Question</button>
        </form>

        {/* Bulk upload */}
        <QuestionBankUpload onUploadSuccess={load} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4>Active Questionnaire ({questions.length}) <span style={{ fontSize: 12, color: C.navyLight, fontWeight: 400 }}>— grouped by InfoSec domain</span></h4>
        {questions.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleAiAnswer} style={{ background: C.accent, color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🤖 AI Auto-Answer</button>
            <button onClick={handleCleanNoise} style={{ background: C.amber, color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🧹 Remove non-question rows</button>
            <button onClick={handleCategorize} style={{ background: C.teal, color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🧠 Auto-categorize</button>
            {isAdmin && <button onClick={handleFreeze} style={{ background: frozen ? C.green : C.navyMid, color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>{frozen ? "🔓 Unfreeze Bank" : "🔒 Freeze Bank"}</button>}
            <button onClick={handleClearAll} style={{ background: C.rose, color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>🗑 Clear All</button>
          </div>
        )}
      </div>
      <QuestionList questions={questions} showAnswers currentUser={currentUser} frozen={frozen} onChanged={load} />
    </div>
  );
}

/* ─── AUDITOR: trigger questionnaire to a vendor ─── */
function AuditorTrigger({ userInfo }) {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [result, setResult] = useState(null); // success popup payload
  const [error, setError] = useState("");
  const [allQuestions, setAllQuestions] = useState([]);
  const [reviewing, setReviewing] = useState(false);      // review modal open
  const [selected, setSelected] = useState(new Set());    // selected question ids

  const load = () => axios.get("http://localhost:5000/api/admin/vendors").then(r => setVendors(r.data));
  useEffect(() => {
    load();
    axios.get("http://localhost:5000/api/questions").then(r => setAllQuestions(r.data));
  }, []);

  const openReview = () => {
    if (!vendorId) { setError("Choose a vendor first."); return; }
    setError("");
    setSelected(new Set(allQuestions.map(q => q.id))); // default: all selected
    setReviewing(true);
  };

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDomain = (qs, allOn) => setSelected(prev => {
    const n = new Set(prev); qs.forEach(q => allOn ? n.delete(q.id) : n.add(q.id)); return n;
  });

  const doTrigger = async (questionIds) => {
    setError("");
    try {
      const fd = new FormData();
      fd.append("vendorId", vendorId);
      fd.append("triggeredBy", userInfo.email);
      if (questionIds) fd.append("questionIds", JSON.stringify(questionIds));
      const res = await axios.post("http://localhost:5000/api/auditor/trigger", fd);
      setResult({ ...res.data, triggeredByName: userInfo.name });
      setVendorId(""); setReviewing(false); load();
    } catch (err) { setError(err.response?.data?.detail || "Error triggering questionnaire."); }
  };

  const groups = {};
  allQuestions.forEach(q => { (groups[q.domain] = groups[q.domain] || []).push(q); });
  const reviewDomains = Object.keys(groups).sort();

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader icon="📤" title="TPRM Audit" subtitle="Review the questionnaire, then trigger it to a vendor" />
      <p style={{ color: C.navyLight, fontSize: 13, margin: "4px 0 0 0" }}>Select a vendor, then <b>Review Questionnaire</b> to add/remove questions before triggering. Reference answers are never shown to the vendor — only used for AI sensing &amp; scoring.</p>
      <div style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", gap: 16, alignItems: "flex-end", margin: "16px 0" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>Select Vendor</label>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)} style={{ width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            <option value="">— choose a vendor —</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName} ({v.email})</option>)}
          </select>
        </div>
        <button onClick={openReview} style={{ background: C.accent, color: "white", padding: "10px 20px", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>📋 Review Questionnaire</button>
      </div>
      <p style={{ fontSize: 12, color: C.navyLight, marginTop: -8, marginBottom: 12 }}>ℹ️ You must review the questionnaire (add/remove questions) before it can be triggered to a vendor.</p>
      {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* REVIEW QUESTIONNAIRE MODAL — add/remove questions */}
      {reviewing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 60, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 10, width: 720, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, color: C.navy }}>Review Questionnaire</h3>
                <span style={{ fontSize: 12, color: C.navyLight }}>Tick to include · {selected.size} of {allQuestions.length} selected</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSelected(new Set(allQuestions.map(q => q.id)))} style={{ fontSize: 12, padding: "6px 10px", border: `1px solid ${C.border}`, background: "white", borderRadius: 4, cursor: "pointer" }}>Select all</button>
                <button onClick={() => setSelected(new Set())} style={{ fontSize: 12, padding: "6px 10px", border: `1px solid ${C.border}`, background: "white", borderRadius: 4, cursor: "pointer" }}>Clear</button>
              </div>
            </div>
            <div style={{ padding: "8px 24px", overflowY: "auto", flex: 1 }}>
              {reviewDomains.map(domain => {
                const qs = groups[domain];
                const allOn = qs.every(q => selected.has(q.id));
                return (
                  <div key={domain} style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: C.navy, padding: "6px 0", borderBottom: `1px solid ${C.slateLight}` }}>
                      <input type="checkbox" checked={allOn} onChange={() => toggleDomain(qs, allOn)} />
                      {domainIcon(domain)} {domain} <span style={{ fontSize: 11, color: C.navyLight, fontWeight: 400 }}>({qs.filter(q => selected.has(q.id)).length}/{qs.length})</span>
                    </label>
                    {qs.map(q => (
                      <label key={q.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, padding: "5px 0 5px 18px", color: selected.has(q.id) ? C.navyMid : C.slate }}>
                        <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} style={{ marginTop: 3 }} />
                        <span>{q.text}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setReviewing(false)} style={{ padding: "10px 18px", background: "#EEE", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => doTrigger([...selected])} disabled={selected.size === 0} style={{ padding: "10px 22px", background: selected.size ? C.accent : C.slate, color: "white", border: "none", borderRadius: 6, cursor: selected.size ? "pointer" : "not-allowed", fontWeight: 700 }}>📤 Trigger {selected.size} Question{selected.size === 1 ? "" : "s"}</button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {result && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 60 }}>
          <div style={{ background: "white", padding: 32, borderRadius: 10, width: 420, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.greenLight, color: C.green, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px auto" }}>✓</div>
            <h3 style={{ margin: "0 0 6px 0", color: C.navy }}>{result.srScore != null ? "SR Seller Audit Completed" : "Questionnaire Triggered"}</h3>
            <p style={{ color: C.navyLight, fontSize: 13, margin: "0 0 18px 0" }}>{result.srScore != null ? "The questionnaire was auto-answered from the reference answer-key and submitted for review." : "The vendor has been notified to complete their assessment."}</p>
            <div style={{ textAlign: "left", background: C.slateLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, fontSize: 14 }}>
              <div style={{ marginBottom: 8 }}><span style={{ color: C.navyLight }}>Vendor:</span> <b>{result.vendor}</b> <span style={{ color: C.navyLight, fontSize: 12 }}>({result.vendorEmail})</span></div>
              <div style={{ marginBottom: result.srScore != null ? 8 : 0 }}><span style={{ color: C.navyLight }}>{result.srScore != null ? "Audited by:" : "Triggered by:"}</span> <b>{result.triggeredByName || result.triggeredBy}</b> <span style={{ color: C.navyLight, fontSize: 12 }}>({result.triggeredBy})</span></div>
              {result.srScore != null && <div><span style={{ color: C.navyLight }}>AI Tentative Score:</span> <b style={{ color: C.accent }}>{result.srScore}/100</b></div>}
            </div>
            <button onClick={() => setResult(null)} style={{ marginTop: 18, background: C.accent, color: "white", border: "none", padding: "10px 28px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Done</button>
          </div>
        </div>
      )}

      <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
            <th style={{ padding: 12 }}>Vendor</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Triggered By</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map(v => (
            <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: 12 }}>{v.companyName}<br /><span style={{ fontSize: 12, color: C.navyLight }}>{v.email}</span></td>
              <td style={{ padding: 12 }}><span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, ...statusConfig[v.tprmStatus] }}>{v.tprmStatus}</span></td>
              <td style={{ padding: 12, fontSize: 13, color: C.navyMid }}>{v.assignedBy || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── AUDITOR: Fill Seller Audit Response (upload questionnaire → auto-answer from bank) ─── */
function FillSellerAudit() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true); setError(""); setData(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await axios.post("http://localhost:5000/api/auditor/fill-seller-audit", fd);
      setData(res.data);
    } catch (err) { setError(err.response?.data?.detail || "Failed to process file."); }
    finally { setBusy(false); }
  };

  const downloadCsv = () => {
    if (!data) return;
    const rows = [["Sheet", "Question", "Yes/No/NA", "Auto-filled Answer", "Matched Question", "Confidence"]]
      .concat(data.results.map(r => [r.sheet || "", r.question, r.choice || "", r.answer, r.matchedQuestion || "", r.confidence]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "seller-audit-filled.csv"; a.click();
  };

  return (
    <div style={{ maxWidth: 950 }}>
      <PageHeader icon="🧾" title="Seller Audit" subtitle="Upload a questionnaire — auto-answered from the answer bank" />
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 16 }}>Upload a questionnaire (.xlsx with a <b>Question Text</b> column). Each question is auto-answered from the admin-loaded answer bank (sensed against the answer DB).</p>
      <div style={{ background: "white", padding: 24, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files[0])} />
        <button onClick={handleUpload} disabled={!file || busy} style={{ background: C.accent, color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: file && !busy ? "pointer" : "not-allowed", fontWeight: 600 }}>{busy ? "Processing…" : "Auto-Fill Responses"}</button>
        {data && <button onClick={downloadCsv} style={{ background: C.navy, color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer" }}>⬇ Download CSV</button>}
      </div>
      {error && <div style={{ color: C.rose, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {data && (
        <>
          <p style={{ fontSize: 13, color: C.navyMid }}><b>{data.filled}/{data.count}</b> questions auto-answered from the answer bank.</p>
          <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
            <thead><tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Sheet</th><th style={{ padding: 12 }}>Question</th><th style={{ padding: 12 }}>Yes/No/NA</th><th style={{ padding: 12 }}>Auto-filled Answer</th><th style={{ padding: 12, textAlign: "right" }}>Match</th>
            </tr></thead>
            <tbody>
              {data.results.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: 12, fontSize: 12, color: C.navyLight, verticalAlign: "top" }}>{r.sheet || "—"}</td>
                  <td style={{ padding: 12, fontSize: 13, verticalAlign: "top" }}>{r.question}</td>
                  <td style={{ padding: 12, verticalAlign: "top" }}><ChoiceBadge value={r.choice} /></td>
                  <td style={{ padding: 12, fontSize: 13, color: (r.answer || r.choice) ? C.navyMid : C.rose, verticalAlign: "top" }}>{r.answer || (r.choice ? "" : "(no match in answer bank)")}</td>
                  <td style={{ padding: 12, fontSize: 12, textAlign: "right", verticalAlign: "top" }}>{r.matchedQuestion ? <span style={{ color: C.teal, fontWeight: 600 }}>{Math.round(r.confidence * 100)}%</span> : <span style={{ color: C.slate }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/* ─── AUDITOR/ADMIN: review vendor responses ─── */
function ReviewResponses() {
  const [vendors, setVendors] = useState([]);
  const [detail, setDetail] = useState(null);
  const [comment, setComment] = useState("");
  const [qVerdicts, setQVerdicts] = useState({}); // per-question accept/flag
  const [qComments, setQComments] = useState({}); // per-question mandatory comment

  const load = () => axios.get("http://localhost:5000/api/admin/vendors").then(r => setVendors(r.data));
  useEffect(() => { load(); }, []);

  const openDetail = async (id) => {
    const res = await axios.get(`http://localhost:5000/api/admin/vendor/${id}`);
    setDetail(res.data); setComment(""); setQVerdicts({}); setQComments({});
  };
  const setVerdict = (qid, v) => setQVerdicts(prev => ({ ...prev, [qid]: prev[qid] === v ? undefined : v }));
  const flaggedCount = Object.values(qVerdicts).filter(v => v === "flag").length;
  const inReview = detail && detail.tprmStatus === "Under Audit Review";

  // Mandatory comments: a final comment AND a comment on every question
  const missingQComments = detail ? detail.responses.filter(r => !String(qComments[r.questionId] || "").trim()).length : 0;
  const commentsComplete = detail && String(comment).trim().length > 0 && missingQComments === 0;

  const act = async (action) => {
    if (!commentsComplete) { alert("Please add a comment on every question and the final review comment before taking any action."); return; }
    const fd = new FormData();
    fd.append("vendorId", detail.id); fd.append("action", action);
    fd.append("comments", JSON.stringify({ final: comment, perQuestion: qComments }));
    await axios.post("http://localhost:5000/api/admin/audit-action", fd);
    setDetail(null); load();
  };

  return (
    <div>
      <PageHeader icon="🛡️" title="Review Responses" subtitle="Comment on each question, set a verdict & generate the report" />
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 16 }}>Open a vendor to review responses, set a verdict, take an action, or generate the TPRM report.</p>
      <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
            <th style={{ padding: 14 }}>Vendor</th><th style={{ padding: 14 }}>AI Risk</th><th style={{ padding: 14 }}>Status</th><th style={{ padding: 14, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map(v => (
            <tr key={v.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: 14 }}><b>{v.companyName}</b><br /><span style={{ fontSize: 12, color: C.navyLight }}>{v.email}</span></td>
              <td style={{ padding: 14 }}>{v.aiRiskSummary ? <span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, ...(riskConfig[v.aiRiskSummary.risk_level] || {}) }}>{v.aiRiskSummary.risk_level}</span> : <span style={{ color: C.slate }}>—</span>}</td>
              <td style={{ padding: 14 }}><span style={{ padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600, ...statusConfig[v.tprmStatus] }}>{v.tprmStatus}</span></td>
              <td style={{ padding: 14, textAlign: "right", whiteSpace: "nowrap" }}>
                <button onClick={() => openDetail(v.id)} style={{ background: C.accent, color: "white", border: "none", padding: "6px 12px", borderRadius: 4, marginRight: 8, cursor: "pointer" }}>Review</button>
                <a href={`http://localhost:5000/api/admin/export-report/${v.id}`} target="_blank" style={{ background: C.navy, color: "white", padding: "6px 12px", textDecoration: "none", borderRadius: 4, fontSize: 13 }}>📄 TPRM Report</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <div style={{ background: "white", padding: 28, borderRadius: 8, width: 640, maxHeight: "88vh", overflowY: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Review: {detail.companyName}</h3>
            <div style={{ fontSize: 12, color: C.navyLight, marginBottom: 12 }}>Triggered by: {detail.assignedBy || "—"} · Status: {detail.tprmStatus}</div>

            {detail.aiRiskSummary && (
              <div style={{ background: C.slateLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <span style={{ fontWeight: 700, color: C.navy }}>🤖 AI Risk: </span>
                <span style={{ padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, ...(riskConfig[detail.aiRiskSummary.risk_level] || {}) }}>{detail.aiRiskSummary.risk_level}</span>
                <p style={{ fontSize: 13, color: C.navyMid, margin: "8px 0 0 0" }}>{detail.aiRiskSummary.summary}</p>
              </div>
            )}

            <h4 style={{ margin: "0 0 8px 0" }}>Responses {inReview && flaggedCount > 0 && <span style={{ fontSize: 12, color: C.rose }}>({flaggedCount} flagged)</span>}</h4>
            {detail.responses.map((r, i) => {
              const verdict = qVerdicts[r.questionId];
              return (
                <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.slateLight}`, borderLeft: verdict === "flag" ? `3px solid ${C.rose}` : verdict === "accept" ? `3px solid ${C.green}` : "3px solid transparent", paddingLeft: 10 }}>
                  <span style={{ fontSize: 11, background: C.skyLight, color: C.sky, padding: "2px 6px", borderRadius: 4 }}>{r.domain}</span>
                  <p style={{ fontWeight: 600, margin: "6px 0 6px 0", color: C.navy }}>{r.question}</p>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 6, flexWrap: "wrap" }}>
                    <span>Vendor: <ChoiceBadge value={r.choice} /></span>
                    {(r.referenceChoice || r.referenceAnswer) && <span style={{ color: C.navyLight }}>Answer key: <ChoiceBadge value={r.referenceChoice} /></span>}
                  </div>
                  {r.answer && <p style={{ margin: "0 0 6px 0", color: C.navyMid, fontSize: 13 }}><b style={{ color: C.navyLight }}>Response:</b> {r.answer}</p>}
                  {r.referenceAnswer && <p style={{ margin: "0 0 6px 0", color: C.teal, fontSize: 12 }}><b>Expected:</b> {r.referenceAnswer}</p>}
                  {/* per-question attachments */}
                  {r.attachments?.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      {r.attachments.map((e, j) => (
                        <a key={j} href={`http://localhost:5000/api/admin/evidence/${encodeURIComponent(e.stored)}`} target="_blank" rel="noreferrer" style={{ color: C.accent, fontSize: 13, marginRight: 12 }}>📎 {e.name}</a>
                      ))}
                    </div>
                  )}
                  {/* per-question action buttons (only while under review) */}
                  {inReview && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setVerdict(r.questionId, "accept")} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, border: `1px solid ${C.green}`, cursor: "pointer", background: verdict === "accept" ? C.green : "white", color: verdict === "accept" ? "white" : C.green }}>✓ Accept</button>
                      <button onClick={() => setVerdict(r.questionId, "flag")} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, border: `1px solid ${C.rose}`, cursor: "pointer", background: verdict === "flag" ? C.rose : "white", color: verdict === "flag" ? "white" : C.rose }}>⚑ Flag</button>
                    </div>
                  )}
                  {/* mandatory per-question comment */}
                  <input
                    value={qComments[r.questionId] || ""}
                    onChange={e => setQComments(prev => ({ ...prev, [r.questionId]: e.target.value }))}
                    placeholder="Auditor comment (required) *"
                    style={{ width: "100%", marginTop: 8, padding: 8, boxSizing: "border-box", borderRadius: 4, border: `1px solid ${String(qComments[r.questionId] || "").trim() ? C.border : C.amber}`, fontSize: 13 }} />
                </div>
              );
            })}

            {detail.evidence?.filter(e => !e.questionId).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ margin: "8px 0 4px 0" }}>Other Attachments</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {detail.evidence.filter(e => !e.questionId).map((e, i) => (
                    <li key={i}><a href={`http://localhost:5000/api/admin/evidence/${encodeURIComponent(e.stored)}`} target="_blank" rel="noreferrer" style={{ color: C.accent }}>{e.name}</a></li>
                  ))}
                </ul>
              </div>
            )}

            {inReview && (
              <div style={{ fontSize: 12, color: C.navyLight, marginTop: 8 }}>
                Tip: use <b>Accept/Flag</b> per question to track issues, then choose an action below.
                Marking <b>Failed</b> returns the questionnaire to the vendor to revise.
              </div>
            )}

            <label style={{ fontSize: 12, display: "block", marginTop: 10, fontWeight: 600 }}>Final review comment <span style={{ color: C.rose }}>*</span> (mandatory)</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Overall audit conclusion (required)" style={{ width: "100%", height: 70, padding: 10, boxSizing: "border-box", margin: "6px 0 8px 0", border: `1px solid ${String(comment).trim() ? C.border : C.amber}`, borderRadius: 4 }} />
            {!commentsComplete && (
              <div style={{ fontSize: 12, color: C.amber, fontWeight: 600, marginBottom: 10 }}>
                ⚠ Add a comment on every question and the final comment to enable actions{missingQComments > 0 ? ` — ${missingQComments} question comment(s) pending` : ""}.
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setDetail(null)} style={{ padding: "8px 14px", background: "#EEE", border: "none", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
              {[["return", "↩ Return to Vendor", C.amber], ["fail", "✗ Mark Failed", C.rose], ["pass", "✓ Mark Passed", C.teal], ["close", "Close", C.navy]].map(([a, label, col]) => (
                <button key={a} onClick={() => act(a)} disabled={!commentsComplete} style={{ padding: "8px 14px", background: commentsComplete ? col : C.slate, color: "white", border: "none", borderRadius: 4, cursor: commentsComplete ? "pointer" : "not-allowed" }}>{label}</button>
              ))}
              <a href={commentsComplete ? `http://localhost:5000/api/admin/export-report/${detail.id}` : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!commentsComplete) { e.preventDefault(); alert("Add all comments before generating the report."); } }} style={{ padding: "8px 14px", background: commentsComplete ? C.accentHover : C.slate, color: "white", borderRadius: 4, textDecoration: "none", fontSize: 13, cursor: commentsComplete ? "pointer" : "not-allowed" }}>📄 Generate Report</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SOC status badge ─── */
const socStatusColor = { "Implemented": C.green, "Partially Implemented": C.amber, "Not Implemented": C.rose, "NA": C.slate };

const SOC = "http://localhost:5000/api/soc";

/* ─── ADMIN + AUDITOR: SOC 2 Internal Audit ─── */
function SocAudit({ userInfo }) {
  const role = userInfo.role;
  const isAdmin = role === "admin";
  const isAuditor = role === "internal_auditor";
  const [data, setData] = useState({ state: {}, controls: [] });
  const [dash, setDash] = useState({ stakeholders: [], totalControls: 0, submittedControls: 0 });
  const [rem, setRem] = useState({ schedule: [], upcoming: [], state: {} });
  const [stopDate, setStopDate] = useState("");
  const [rc, setRc] = useState({});       // controlId -> review comment
  const [mapDraft, setMapDraft] = useState({}); // controlId -> email being typed

  const load = () => {
    axios.get(`${SOC}/controls`).then(r => setData(r.data)).catch(() => {});
    axios.get(`${SOC}/dashboard`).then(r => setDash(r.data)).catch(() => {});
    axios.get(`${SOC}/reminders`).then(r => setRem(r.data)).catch(() => {});
  };
  useEffect(() => { load(); const t = setInterval(() => axios.get(`${SOC}/dashboard`).then(r => setDash(r.data)).catch(() => {}), 30000); return () => clearInterval(t); }, []);

  const st = data.state || {};
  const controls = data.controls || [];

  const upload = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    try { const r = await axios.post(`${SOC}/upload-controls`, fd); alert(r.data.message); load(); }
    catch (err) { alert(err.response?.data?.detail || "Upload failed."); }
    e.target.value = "";
  };
  const map = async (c, email) => { const fd = new FormData(); fd.append("stakeholderEmail", email); await axios.post(`${SOC}/controls/${c.id}/map`, fd); load(); };
  const submitApproval = async () => { try { const r = await axios.post(`${SOC}/submit-for-approval`); alert(r.data.message); load(); } catch (e) { alert(e.response?.data?.detail || "Failed."); } };
  const approve = async (ok) => { const fd = new FormData(); fd.append("approved", ok); fd.append("role", role); try { const r = await axios.post(`${SOC}/approve`, fd); alert(r.data.message); load(); } catch (e) { alert(e.response?.data?.detail || "Failed."); } };
  const trigger = async () => {
    if (!window.confirm("Trigger the SOC 2 audit? Stakeholder accounts will be created and notified.")) return;
    try { const r = await axios.post(`${SOC}/trigger`); alert(r.data.message + (r.data.devCreds ? "\n\nDev logins (no SMTP):\n" + r.data.devCreds.map(c => `${c.email} / ${c.password}`).join("\n") + "\nMFA 123456" : "")); load(); }
    catch (e) { alert(e.response?.data?.detail || "Failed."); }
  };
  const review = async (c, action) => { const fd = new FormData(); fd.append("action", action); fd.append("comment", rc[c.id] || ""); await axios.post(`${SOC}/control/${c.id}/review`, fd); load(); };
  const stop = async () => { if (!stopDate) { alert("Pick an effective date."); return; } if (!window.confirm("Stop evidence collection? Stakeholders will be notified.")) return; const fd = new FormData(); fd.append("stopDate", stopDate); const r = await axios.post(`${SOC}/stop-collection`, fd); alert(r.data.message); load(); };
  const nudge = async () => { if (!window.confirm("Send a summarised-status reminder to all stakeholders with pending controls now?")) return; const fd = new FormData(); fd.append("force", true); const r = await axios.post(`${SOC}/run-reminders`, fd); alert(r.data.message); load(); };
  const finalize = async () => { if (!window.confirm("Conclude the audit? Automated reminders will stop permanently.")) return; const r = await axios.post(`${SOC}/finalize`); alert(r.data.message); load(); };

  const phase = st.collectionStopped ? "Collection stopped" : st.triggered ? "In progress (triggered)" : st.approved ? "Approved — ready to trigger" : st.submittedForApproval ? "Pending admin approval" : controls.length ? "Draft (map stakeholders)" : "No control list uploaded";
  const canMap = isAuditor && !st.triggered;
  const th = { padding: "8px 10px", textAlign: "left", fontSize: 12 };
  const td = { padding: "8px 10px", fontSize: 13, verticalAlign: "top", borderTop: `1px solid ${C.slateLight}` };

  return (
    <div>
      <PageHeader icon="🔐" title="SOC 2 Internal Audit" subtitle={`Phase: ${phase}`} />

      {/* Action bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        {isAuditor && !st.triggered && (
          <label style={{ background: C.accent, color: "white", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            ⬆️ Upload Control List<input type="file" accept=".xlsx,.xls" onChange={upload} style={{ display: "none" }} />
          </label>
        )}
        {isAuditor && controls.length > 0 && !st.approved && !st.submittedForApproval && (
          <button onClick={submitApproval} style={{ background: C.teal, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>📨 Submit for Admin Approval</button>
        )}
        {isAdmin && st.submittedForApproval && !st.approved && (
          <>
            <button onClick={() => approve(true)} style={{ background: C.green, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>✓ Approve Control List</button>
            <button onClick={() => approve(false)} style={{ background: C.amber, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>↩ Send Back</button>
          </>
        )}
        {isAuditor && st.approved && !st.triggered && (
          <button onClick={trigger} style={{ background: C.accent, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>📤 Trigger Audit to Stakeholders</button>
        )}
        {isAuditor && st.triggered && !st.collectionStopped && (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="date" value={stopDate} onChange={e => setStopDate(e.target.value)} style={{ padding: 8, border: `1px solid ${C.border}`, borderRadius: 6 }} />
            <button onClick={stop} style={{ background: C.rose, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>⛔ Stop Collection</button>
          </span>
        )}
        {isAuditor && st.triggered && !st.finalized && (
          <button onClick={nudge} style={{ background: C.teal, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>🔔 Send Reminder Now</button>
        )}
        {isAuditor && st.triggered && !st.finalized && (
          <button onClick={finalize} style={{ background: C.navyMid, color: "white", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>🏁 Conclude Audit</button>
        )}
        <a href={`${SOC}/report/full`} target="_blank" rel="noreferrer" style={{ background: C.navy, color: "white", padding: "10px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}>📄 Full SOC 2 Report</a>
      </div>

      {/* Reminder cadence panel */}
      {st.triggered && (
        <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h4 style={{ margin: 0 }}>🔔 Automated Reminders</h4>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 12, background: st.finalized ? C.slateLight : st.collectionStopped ? C.amber + "22" : C.green + "22", color: st.finalized ? C.slate : st.collectionStopped ? C.amber : C.green }}>
              {st.finalized ? "Concluded — reminders stopped" : st.collectionStopped ? `Summary-only mode (collection stopped${st.stopDate ? ` ${st.stopDate}` : ""})` : `Active${st.week ? ` — Week ${st.week}` : ""}`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
            {(rem.schedule || []).map((s, i) => {
              const activePhase = !st.finalized && (st.collectionStopped ? s.phase.startsWith("After") : st.week >= 5 ? s.phase.startsWith("Week 5") : st.week >= 3 ? s.phase.startsWith("Week 3") : s.phase.startsWith("Week 1"));
              return (
                <div key={i} style={{ border: `1px solid ${activePhase ? C.accent : C.slateLight}`, background: activePhase ? C.accent + "0d" : "transparent", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: activePhase ? C.accent : C.navyMid }}>{s.phase}{activePhase ? " ●" : ""}</div>
                  <div style={{ fontSize: 11, color: C.navyLight, marginTop: 3 }}>{s.days}</div>
                  <div style={{ fontSize: 11, color: C.navyLight }}>{s.times}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12, fontSize: 12, color: C.navyLight }}>
            <span>Last sent: <b>{st.lastReminderAt ? new Date(st.lastReminderAt).toLocaleString() : "—"}</b>{st.lastReminderCount ? ` (${st.lastReminderCount} stakeholder${st.lastReminderCount === "1" ? "" : "s"})` : ""}</span>
            {!st.finalized && (rem.upcoming || []).length > 0 && (
              <span>Next run: <b>{(() => { const ns = (rem.upcoming || []).map(u => u.next).filter(Boolean).sort(); return ns.length ? new Date(ns[0]).toLocaleString() : "—"; })()}</b></span>
            )}
          </div>
          <p style={{ fontSize: 11, color: C.slate, margin: "8px 0 0 0" }}>Each reminder emails stakeholders with pending controls a summarised status (submitted / pending). Reminders auto-escalate by audit week and switch to summary-only after collection is stopped.</p>
        </div>
      )}

      {/* Dashboard */}
      {st.triggered && (
        <>
          <h4 style={{ margin: "8px 0 8px 0" }}>📊 Stakeholder Progress</h4>
          <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
            <thead><tr style={{ background: C.navy, color: "white", textAlign: "left" }}>
              <th style={{ padding: 12 }}>Stakeholder</th><th style={{ padding: 12 }}>Submitted</th><th style={{ padding: 12 }}>Evidence</th><th style={{ padding: 12 }}>Reviewed</th><th style={{ padding: 12 }}>Progress</th><th style={{ padding: 12, textAlign: "right" }}>Report</th>
            </tr></thead>
            <tbody>
              {dash.stakeholders.map((s, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: 12 }}>{s.name || s.stakeholder}<br /><span style={{ fontSize: 11, color: C.navyLight }}>{s.stakeholder}</span></td>
                  <td style={{ padding: 12 }}>{s.submitted}/{s.total}</td>
                  <td style={{ padding: 12 }}>{s.evidence}/{s.total}</td>
                  <td style={{ padding: 12 }}>{s.reviewed}/{s.total}</td>
                  <td style={{ padding: 12, minWidth: 120 }}>
                    <div style={{ height: 8, background: C.slateLight, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${s.progress}%`, height: "100%", background: s.progress === 100 ? C.green : C.accent }} /></div>
                    <span style={{ fontSize: 11, color: C.navyLight }}>{s.progress}%</span>
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }}>{s.stakeholder !== "(unmapped)" && <a href={`${SOC}/report/stakeholder/${encodeURIComponent(s.stakeholder)}`} target="_blank" rel="noreferrer" style={{ color: C.accent, fontSize: 13 }}>📄 Report</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Controls table */}
      <h4 style={{ margin: "8px 0 8px 0" }}>Controls ({controls.length})</h4>
      {controls.length === 0 && <p style={{ color: C.navyLight }}>No controls uploaded yet.</p>}
      {controls.length > 0 && (
        <table style={{ width: "100%", background: "white", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden" }}>
          <thead><tr style={{ background: C.slateLight, color: C.navyMid }}>
            <th style={{ ...th, width: 70 }}>Control</th><th style={th}>Description</th><th style={{ ...th, width: 200 }}>Stakeholder</th><th style={{ ...th, width: 110 }}>Status</th><th style={{ ...th, width: 200 }}>Review</th>
          </tr></thead>
          <tbody>
            {controls.map(c => (
              <tr key={c.id}>
                <td style={{ ...td, fontWeight: 700, color: C.navyMid }}>{c.controlId}<div style={{ fontSize: 10, color: C.slate, fontWeight: 400 }}>{c.domain}</div></td>
                <td style={td}>{c.description}</td>
                <td style={td}>
                  {canMap
                    ? <input defaultValue={c.mappedTo || ""} placeholder="stakeholder@email" onBlur={e => e.target.value.trim() !== (c.mappedTo || "") && map(c, e.target.value.trim())} style={{ width: "100%", padding: 6, border: `1px solid ${c.mappedTo ? C.border : C.amber}`, borderRadius: 4, fontSize: 12 }} />
                    : <span style={{ fontSize: 12 }}>{c.mappedTo || <span style={{ color: C.rose }}>unmapped</span>}</span>}
                </td>
                <td style={td}>
                  {c.submitted
                    ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: socStatusColor[c.status] ? socStatusColor[c.status] + "22" : C.slateLight, color: socStatusColor[c.status] || C.navyMid }}>{c.status || "Submitted"}</span>
                    : <span style={{ fontSize: 11, color: C.slate }}>not submitted</span>}
                </td>
                <td style={td}>
                  {c.submitted && isAuditor && (
                    <div>
                      <input value={rc[c.id] || ""} onChange={e => setRc({ ...rc, [c.id]: e.target.value })} placeholder="comment" style={{ width: "100%", padding: 5, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, marginBottom: 4 }} />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => review(c, "pass")} style={{ flex: 1, fontSize: 11, padding: "3px 4px", border: "none", borderRadius: 4, background: C.teal, color: "white", cursor: "pointer" }}>Pass</button>
                        <button onClick={() => review(c, "fail")} style={{ flex: 1, fontSize: 11, padding: "3px 4px", border: "none", borderRadius: 4, background: C.rose, color: "white", cursor: "pointer" }}>Fail</button>
                        <button onClick={() => review(c, "return")} style={{ flex: 1, fontSize: 11, padding: "3px 4px", border: "none", borderRadius: 4, background: C.amber, color: "white", cursor: "pointer" }}>Return</button>
                      </div>
                    </div>
                  )}
                  {c.reviewStatus && <div style={{ fontSize: 11, marginTop: 4, color: c.reviewStatus === "pass" ? C.green : c.reviewStatus === "fail" ? C.rose : C.amber, fontWeight: 600 }}>Verdict: {c.reviewStatus}</div>}
                  {!c.submitted && !c.reviewStatus && <span style={{ fontSize: 11, color: C.slate }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── STAKEHOLDER: fill assigned SOC 2 controls (evidence + justification) ─── */
function StakeholderDashboard({ userInfo }) {
  const [data, setData] = useState({ state: {}, controls: [] });
  const [saveState, setSaveState] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [auditors, setAuditors] = useState([]);
  const [selAud, setSelAud] = useState("");
  const [helpMsg, setHelpMsg] = useState("");

  const load = () => axios.get(`${SOC}/my-controls?email=${encodeURIComponent(userInfo.email)}`).then(r => setData(r.data)).catch(() => {});
  useEffect(() => { load(); axios.get(`${SOC}/auditors`).then(r => setAuditors(r.data)).catch(() => {}); }, [userInfo.email]);

  const st = data.state || {};
  const controls = data.controls || [];
  const stopped = st.collectionStopped;
  const setField = (c, field, value) => setData(prev => ({ ...prev, controls: prev.controls.map(x => x.id === c.id ? { ...x, [field]: value } : x) }));
  const saveControl = async (c) => {
    const fd = new FormData(); fd.append("email", userInfo.email); fd.append("controlId", c.id);
    fd.append("status", c.status || ""); fd.append("remark", c.remark || ""); fd.append("justification", c.justification || "");
    try { await axios.post(`${SOC}/control/save`, fd); setSaveState("Saved ✓"); setTimeout(() => setSaveState(""), 1500); }
    catch (e) { alert(e.response?.data?.detail || "Save failed."); }
  };
  const uploadEv = async (e, c) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append("email", userInfo.email); fd.append("controlId", c.id); fd.append("file", f);
    try { const r = await axios.post(`${SOC}/control/upload-evidence`, fd); setField(c, "evidence", r.data.evidence); }
    catch (err) { alert(err.response?.data?.detail || "Upload failed."); }
    e.target.value = "";
  };
  const completeOf = (c) => (c.status ? 1 : 0) + (String(c.justification || "").trim() ? 1 : 0) + ((c.evidence || []).length ? 1 : 0);
  const statOf = (c) => { const n = completeOf(c); return n === 0 ? "pending" : n === 3 ? "filled" : "partial"; };
  const filledN = controls.filter(c => statOf(c) === "filled").length;
  const partialN = controls.filter(c => statOf(c) === "partial").length;
  const pendingN = controls.filter(c => statOf(c) === "pending").length;
  const allSubmitted = controls.length > 0 && controls.every(c => c.submitted);
  const complete = controls.length > 0 && filledN === controls.length;

  const submitAll = async () => {
    const fd = new FormData(); fd.append("email", userInfo.email);
    try { const r = await axios.post(`${SOC}/submit`, fd); alert(r.data.message); load(); }
    catch (e) { alert(e.response?.data?.detail || "Submit failed."); }
  };
  const connect = async () => {
    if (!selAud) { alert("Select an auditor."); return; }
    const fd = new FormData(); fd.append("stakeholderEmail", userInfo.email); fd.append("auditorEmail", selAud); fd.append("message", helpMsg);
    try { const r = await axios.post(`${SOC}/help-connect`, fd); alert(r.data.message); setHelpOpen(false); setHelpMsg(""); }
    catch (e) { alert(e.response?.data?.detail || "Failed."); }
  };

  return (
    <div style={{ maxWidth: 1280, display: "flex", gap: 18, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <PageHeader icon="📋" title="My SOC 2 Controls" subtitle="Provide status, justification and evidence for each assigned control"
          right={<button onClick={() => setHelpOpen(true)} style={{ background: "white", color: C.accent, border: `1px solid ${C.accent}`, padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>💬 Help — connect to an auditor</button>} />

        {stopped && <div style={{ background: C.amberLight, color: C.amber, padding: 14, borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>⛔ Evidence collection has been closed by the auditor. Your controls are read-only.</div>}
        {allSubmitted && !stopped && <div style={{ background: C.greenLight, color: C.green, padding: 14, borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>✓ Submitted and under audit review.</div>}
        {controls.length === 0 && <p style={{ color: C.navyLight }}>No controls assigned to you yet.</p>}

        {controls.map(c => {
          const ro = c.submitted || stopped;
          return (
            <div key={c.id} id={`soc-${c.id}`} style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: 18, marginBottom: 14, borderLeft: `4px solid ${statOf(c) === "filled" ? C.green : statOf(c) === "partial" ? C.amber : C.rose}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{c.controlId} · {c.domain}</span>
                {c.reviewStatus && <span style={{ fontSize: 11, fontWeight: 700, color: c.reviewStatus === "pass" ? C.green : c.reviewStatus === "fail" ? C.rose : C.amber }}>Auditor: {c.reviewStatus}{c.reviewComment ? ` — ${c.reviewComment}` : ""}</span>}
              </div>
              <p style={{ fontWeight: 600, color: C.navy, margin: "6px 0 10px 0" }}>{c.description}</p>
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.navyMid, fontWeight: 600 }}>Status *</label>
                  <select value={c.status || ""} disabled={ro} onChange={e => setField(c, "status", e.target.value)} onBlur={() => saveControl(c)} style={{ width: "100%", padding: 8, marginTop: 4, border: `1px solid ${C.border}`, borderRadius: 4 }}>
                    <option value="">— select —</option><option>Implemented</option><option>Partially Implemented</option><option>Not Implemented</option><option>NA</option>
                  </select>
                  <label style={{ fontSize: 11, color: C.navyMid, fontWeight: 600, display: "block", marginTop: 8 }}>Remark</label>
                  <input value={c.remark || ""} disabled={ro} onChange={e => setField(c, "remark", e.target.value)} onBlur={() => saveControl(c)} style={{ width: "100%", padding: 8, marginTop: 4, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.navyMid, fontWeight: 600 }}>Detailed justification *</label>
                  <textarea value={c.justification || ""} disabled={ro} onChange={e => setField(c, "justification", e.target.value)} onBlur={() => saveControl(c)} maxLength={8000} style={{ width: "100%", height: 64, padding: 8, marginTop: 4, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4 }} />
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    {(c.evidence || []).map((e, i) => <a key={i} href={`http://localhost:5000/api/admin/evidence/${encodeURIComponent(e.stored)}`} target="_blank" rel="noreferrer" style={{ color: C.accent, marginRight: 10 }}>📎 {e.name}</a>)}
                    {!ro && <label style={{ cursor: "pointer", color: C.accent, fontWeight: 600 }}>＋ Add evidence *<input type="file" onChange={e => uploadEv(e, c)} style={{ display: "none" }} /></label>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {controls.length > 0 && !allSubmitted && !stopped && (
          <button onClick={submitAll} disabled={!complete} style={{ width: "100%", marginTop: 8, background: complete ? C.accent : C.slate, color: "white", padding: 14, border: "none", borderRadius: 6, fontWeight: 700, cursor: complete ? "pointer" : "not-allowed" }}>
            {complete ? "Submit All Controls for Review" : `Complete status, justification & evidence on every control (${filledN}/${controls.length})`}
          </button>
        )}
      </div>

      {/* progress panel */}
      {controls.length > 0 && (
        <div style={{ width: 230, position: "sticky", top: 0, flexShrink: 0, background: "white", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.slateLight}`, fontWeight: 700, color: C.navy }}>📊 Progress</div>
          <div style={{ padding: "10px 14px", fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>🟢 Filled</span><b style={{ color: C.green }}>{filledN}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>🟠 Partial</span><b style={{ color: C.amber }}>{partialN}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>🔴 Pending</span><b style={{ color: C.rose }}>{pendingN}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.slateLight}`, paddingTop: 6 }}><span>Total</span><b>{controls.length}</b></div>
            {saveState && <span style={{ color: C.green, fontSize: 12 }}>{saveState}</span>}
          </div>
        </div>
      )}

      {helpOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 70, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 10, width: 420, padding: 26 }}>
            <h3 style={{ marginTop: 0, color: C.navy }}>Connect to an Auditor</h3>
            <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Select auditor</label>
            <select value={selAud} onChange={e => setSelAud(e.target.value)} style={{ width: "100%", padding: 10, margin: "6px 0 12px", border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <option value="">— choose —</option>
              {auditors.map(a => <option key={a.email} value={a.email}>{a.name || a.email} ({a.email})</option>)}
            </select>
            <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600 }}>Message (optional)</label>
            <textarea value={helpMsg} onChange={e => setHelpMsg(e.target.value)} style={{ width: "100%", height: 64, padding: 8, margin: "6px 0 14px", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 6 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setHelpOpen(false)} style={{ padding: "9px 16px", background: "#EEE", border: "none", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
              <button onClick={connect} style={{ padding: "9px 16px", background: C.accent, color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── VENDOR: security certifications (gates the questionnaire) ─── */
function VendorCertifications({ userInfo }) {
  const [c, setC] = useState({});
  const [saved, setSaved] = useState("");
  const [override, setOverride] = useState(false);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/vendor/certifications?email=${encodeURIComponent(userInfo.email)}`).then(r => setC(r.data.certifications || {})).catch(() => {});
    axios.get(`http://localhost:5000/api/vendor/state?email=${encodeURIComponent(userInfo.email)}`).then(r => setOverride(!!r.data.certOverride)).catch(() => {});
  }, [userInfo.email]);

  const toggle = (k) => setC(prev => ({ ...prev, [k]: !prev[k] }));
  const save = async () => {
    const fd = new FormData();
    fd.append("email", userInfo.email); fd.append("certifications", JSON.stringify(c));
    try { await axios.post("http://localhost:5000/api/vendor/certifications", fd); setSaved("Saved ✓"); setTimeout(() => setSaved(""), 2500); }
    catch (err) { alert(err.response?.data?.detail || "Could not save."); }
  };

  const items = [["iso27001", "ISO 27001"], ["soc2type2", "SOC 2 Type 2"], ["pcidss", "PCI DSS"], ["dpdpa", "DPDPA Compliant"]];
  const exempt = !!(c.iso27001 && c.soc2type2);

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader icon="🔐" title="Security Certifications" subtitle="Declare ISO 27001, SOC 2, PCI DSS, DPDPA — may waive the questionnaire" />
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 18 }}>Declare the security certifications your organisation holds. If you hold both <b>ISO 27001</b> and <b>SOC 2 Type 2</b>, the detailed questionnaire is not required (unless an AeroGuard admin requests it). If either is missing, you'll need to complete the questionnaire.</p>
      <div style={{ background: "white", padding: 28, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {items.map(([k, label]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: `1px solid ${c[k] ? C.green : C.border}`, borderRadius: 8, cursor: "pointer", background: c[k] ? C.greenLight : "white" }}>
              <input type="checkbox" checked={!!c[k]} onChange={() => toggle(k)} />
              <span style={{ fontWeight: 600, color: C.navy }}>{label}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={save} style={{ background: C.accent, color: "white", border: "none", padding: "12px 24px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Save Certifications</button>
          {saved && <span style={{ color: C.green, fontWeight: 600 }}>{saved}</span>}
        </div>
        <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: exempt && !override ? C.greenLight : C.amberLight, color: exempt && !override ? C.green : C.amber, fontSize: 13, fontWeight: 600 }}>
          {override
            ? "ℹ️ An AeroGuard admin has requested the questionnaire — please complete it under My Assessment regardless of certifications."
            : exempt
              ? "✓ ISO 27001 + SOC 2 Type 2 on file — the security questionnaire is currently waived for you."
              : "⚠ ISO 27001 and/or SOC 2 Type 2 missing — please complete the questionnaire under My Assessment."}
        </div>
      </div>
    </div>
  );
}

/* ─── VENDOR: company profile / details (attached to the final report) ─── */
function VendorDetails({ userInfo }) {
  const [d, setD] = useState({});
  const [saved, setSaved] = useState("");

  useEffect(() => {
    axios.get(`http://localhost:5000/api/vendor/details?email=${encodeURIComponent(userInfo.email)}`)
      .then(r => setD(r.data.details || {})).catch(() => {});
  }, [userInfo.email]);

  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));
  const save = async () => {
    const fd = new FormData();
    fd.append("email", userInfo.email);
    fd.append("details", JSON.stringify(d));
    try { await axios.post("http://localhost:5000/api/vendor/details", fd); setSaved("Saved ✓"); setTimeout(() => setSaved(""), 2500); }
    catch (err) { alert(err.response?.data?.detail || "Could not save details."); }
  };

  const fields = [
    ["legalName", "Legal Entity Name"], ["registrationNo", "Registration / CIN No."],
    ["country", "Country"], ["website", "Website"],
    ["contactName", "Primary Contact Name"], ["contactEmail", "Contact Email"],
    ["contactPhone", "Contact Phone"], ["securityContact", "Security / DPO Contact"],
  ];
  const inputStyle = { width: "100%", padding: 10, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 6 };

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader icon="🏢" title="Vendor Details" subtitle="Company profile — attached to the final TPRM report" />
      <p style={{ color: C.navyLight, fontSize: 13, marginBottom: 18 }}>These details are attached to your assessment and included in the final TPRM report. Please keep them up to date.</p>
      <div style={{ background: "white", padding: 28, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {fields.map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600, display: "block", marginBottom: 4 }}>{label}</label>
              <input
                type={k === "contactEmail" ? "email" : k === "website" ? "url" : "text"}
                value={d[k] || ""}
                onChange={e => set(k, e.target.value)}
                maxLength={200}
                {...(k === "contactPhone" ? { pattern: "[0-9+\\-()\\s]{7,30}", title: "Digits and + - ( ) only" } : {})}
                style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600, display: "block", marginBottom: 4 }}>Registered Address</label>
          <textarea value={d.address || ""} onChange={e => set("address", e.target.value)} maxLength={1000} style={{ ...inputStyle, height: 60 }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: C.navyMid, fontWeight: 600, display: "block", marginBottom: 4 }}>Services Provided</label>
          <textarea value={d.services || ""} onChange={e => set("services", e.target.value)} maxLength={1000} placeholder="Brief description of the services / scope provided to AeroGuard" style={{ ...inputStyle, height: 70 }} />
        </div>
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={save} style={{ background: C.accent, color: "white", border: "none", padding: "12px 24px", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Save Vendor Details</button>
          {saved && <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>{saved}</span>}
        </div>
      </div>
    </div>
  );
}

function VendorQuestionnaire({ userInfo }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [evidence, setEvidence] = useState([]);
  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState("");   // "", "Saving…", "Saved"
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);            // AI tentative score (0-100)
  const [showBlockers, setShowBlockers] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [qEnabled, setQEnabled] = useState(true);   // gated by security certifications
  const [help, setHelp] = useState({});             // qid -> AI suggestion
  const [helpLoading, setHelpLoading] = useState(null);

  const handleHelp = async (q) => {
    if (help[q.id]) { setHelp(prev => { const n = { ...prev }; delete n[q.id]; return n; }); return; }
    setHelpLoading(q.id);
    try {
      const res = await axios.post("http://localhost:5000/api/vendor/help", { question: q.text, domain: q.domain });
      setHelp(prev => ({ ...prev, [q.id]: res.data.suggestion }));
    } catch { setHelp(prev => ({ ...prev, [q.id]: "AI help is unavailable right now." })); }
    finally { setHelpLoading(null); }
  };

  const goToQuestion = (qid) => {
    setShowBlockers(false);
    setHighlightId(qid);
    setTimeout(() => {
      const el = document.getElementById(`vq-${qid}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    setTimeout(() => setHighlightId(null), 2600);
  };
  const loadedRef = React.useRef(false);

  // Load questions + saved draft on mount
  useEffect(() => {
    (async () => {
      const [qRes, sRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/vendor/questions?email=${encodeURIComponent(userInfo.email)}`),
        axios.get(`http://localhost:5000/api/vendor/state?email=${encodeURIComponent(userInfo.email)}`),
      ]);
      setQuestions(qRes.data);
      const st = sRes.data;
      setStatus(st.tprmStatus);
      setEvidence(st.evidence || []);
      setScore(st.vendorScore || 0);
      setQEnabled(st.questionnaireEnabled !== false);
      const base = Object.keys(st.draftAnswers || {}).length ? st.draftAnswers : (st.submittedAnswers || {});
      const norm = {};
      Object.keys(base || {}).forEach(k => {
        const v = base[k];
        norm[k] = (v && typeof v === "object")
          ? { choice: v.choice || "", response: v.response || "" }
          : { choice: "", response: String(v || "") };
      });
      setAnswers(norm);
      if (["Under Audit Review", "Verified", "Closed"].includes(st.tprmStatus)) setSubmitted(true);
      loadedRef.current = true;
    })();
  }, [userInfo.email]);

  // Debounced autosave whenever answers change (after initial load)
  useEffect(() => {
    if (!loadedRef.current || submitted) return;
    setSaveState("Saving…");
    const t = setTimeout(async () => {
      const fd = new FormData();
      fd.append("email", userInfo.email);
      fd.append("answers", JSON.stringify(answers));
      try {
        const res = await axios.post("http://localhost:5000/api/vendor/save-draft", fd);
        setSaveState("Saved ✓");
        if (typeof res.data.score === "number") setScore(res.data.score);
      } catch { setSaveState("Save failed"); }
    }, 900);
    return () => clearTimeout(t);
  }, [answers, submitted, userInfo.email]);

  const total = questions.length;
  const getA = (qid) => answers[qid] || { choice: "", response: "" };
  const setField = (qid, field, value) => setAnswers(prev => ({ ...prev, [qid]: { ...(prev[qid] || { choice: "", response: "" }), [field]: value } }));
  const attsFor = (qid) => evidence.filter(e => e.questionId === qid);

  // Completion requirements:
  //   • Vendor Response (Yes/No/NA) selected on 100% of questions
  //   • Vendor Remarks written on ≥98% of questions
  //   • Attachment added on ≥98% of questions
  const answeredCount = questions.filter(q => getA(q.id).choice).length;          // choices
  const remarkCount = questions.filter(q => String(getA(q.id).response || "").trim()).length;
  const attachCount = questions.filter(q => attsFor(q.id).length > 0).length;
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;
  const remarkPct = total ? Math.round((remarkCount / total) * 100) : 0;
  const attachPct = total ? Math.round((attachCount / total) * 100) : 0;
  const choiceOk = total > 0 && answeredCount === total;
  const remarkOk = total > 0 && remarkPct >= 98;
  const attachOk = total > 0 && attachPct >= 98;
  const complete = choiceOk && remarkOk && attachOk;

  // Blockers preventing final submission
  const blockers = questions.map(q => {
    const a = getA(q.id);
    const missing = [];
    if (!a.choice) missing.push("Vendor Response");
    if (!String(a.response || "").trim()) missing.push("Vendor Remarks");
    if (attsFor(q.id).length === 0) missing.push("Attachment");
    return { q, missing };
  }).filter(b => b.missing.length);

  const isReturned = status === "Action Required" && !submitted;
  const th = { padding: "8px 12px", textAlign: "left", fontSize: 12 };
  const td = { padding: "10px 12px", fontSize: 13, verticalAlign: "top" };

  // Per-question fill status for the progress panel
  const statusOf = (q) => {
    const a = getA(q.id);
    const n = (a.choice ? 1 : 0) + (String(a.response || "").trim() ? 1 : 0) + (attsFor(q.id).length ? 1 : 0);
    return n === 0 ? "pending" : n === 3 ? "filled" : "partial";
  };
  const filledN = questions.filter(q => statusOf(q) === "filled").length;
  const partialN = questions.filter(q => statusOf(q) === "partial").length;
  const pendingN = questions.filter(q => statusOf(q) === "pending").length;

  const handleEvidence = async (e, questionId) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("email", userInfo.email);
    fd.append("file", file);
    if (questionId) fd.append("questionId", questionId);
    const res = await axios.post("http://localhost:5000/api/vendor/upload-evidence", fd);
    setEvidence(res.data.evidence);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    const fd = new FormData();
    fd.append("email", userInfo.email);
    fd.append("answers", JSON.stringify(answers));
    try {
      await axios.post("http://localhost:5000/api/vendor/submit-questionnaire", fd);
      setSubmitted(true); setStatus("Under Audit Review");
      alert("Submitted successfully. The auditor and AeroGuard admins have been notified.");
    } catch (err) { alert(err.response?.data?.detail || "Submission failed."); }
  };

  // AI Assessment Score colour — same matrix as the completion bar (<50 red, 50–90 amber, >90 green)
  const scoreColor = score > 90 ? C.green : score >= 50 ? C.amber : C.rose;
  // Completion bar colour: <50% red, 50–90% amber, >90% green
  const barColor = pct > 90 ? C.green : pct >= 50 ? C.amber : C.rose;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 18, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #EDE7FF, #DCD2FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 2px 6px rgba(115,60,242,0.12)" }}>📝</span>
          <h2 style={{ margin: 0, color: C.navy, fontSize: 22 }}>My Assessment</h2>
        </div>
        {qEnabled && total > 0 && <span style={{ background: C.navy, color: "white", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 14 }}>📋 Total Questions: {total}</span>}
      </div>

      {!qEnabled && (
        <div style={{ background: C.greenLight, color: C.green, padding: 18, borderRadius: 8, fontWeight: 600 }}>
          🔐 You are currently exempt from the security questionnaire — your <b>ISO 27001</b> and <b>SOC 2 Type 2</b> certifications are on file. If an AeroGuard admin requests it, the questionnaire will appear here.
        </div>
      )}

      {/* ── STICKY BAR ── completion + live AI tentative score, stays visible while scrolling */}
      {qEnabled && total > 0 && (
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: "white", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: C.navyLight }}>
              <span style={{ padding: "3px 8px", borderRadius: 4, fontWeight: 600, ...statusConfig[status] }}>{status || "—"}</span>
              {!submitted && <span>{saveState}</span>}
            </span>
            {/* AI tentative score x/100 */}
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.navyLight }}>🤖 AI Assessment Score</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: scoreColor }}>{score}/100</span>
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.navyLight, marginBottom: 4 }}>
            <span>Completion</span><span>{answeredCount}/{total} answered ({pct}%)</span>
          </div>
          <div style={{ height: 8, background: C.slateLight, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width .3s, background .3s" }} />
          </div>
          {/* tentative-score banner */}
          <div style={{ marginTop: 8, fontSize: 11, color: C.amber, background: C.amberLight, borderRadius: 4, padding: "5px 8px", fontWeight: 600 }}>
            ⓘ This is a tentative AI score of your vendor assessment — it updates as you respond and is finalised by the auditor.
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ background: C.greenLight, color: C.green, padding: 14, borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>
          ✓ Your responses have been submitted and are under audit review.
        </div>
      )}
      {isReturned && (
        <div style={{ background: C.amberLight, color: C.amber, padding: 14, borderRadius: 8, marginBottom: 20, fontWeight: 600 }}>
          ↩ Your submission was reviewed and returned. Please update the flagged responses and submit again.
        </div>
      )}

      {qEnabled && total === 0 && <p style={{ color: C.navyLight }}>No questionnaire has been assigned yet.</p>}

      {qEnabled && (() => {
        const groups = {};
        questions.forEach(q => { (groups[q.domain] = groups[q.domain] || []).push(q); });
        return Object.keys(groups).sort().map(domain => (
          <div key={domain} style={{ marginBottom: 16, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: "white" }}>
            <div style={{ background: C.navy, color: "white", padding: "10px 16px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>{domainIcon(domain)} {domain}</span>
              <span style={{ fontSize: 12, background: "rgba(255,255,255,0.18)", padding: "2px 10px", borderRadius: 12 }}>{groups[domain].length}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.slateLight, color: C.navyMid }}>
                  <th style={{ ...th, width: 50 }}>S.No</th>
                  <th style={th}>Assessment Questions</th>
                  <th style={{ ...th, width: 150 }}>Vendor Response <span style={{ color: C.rose }}>*</span></th>
                  <th style={{ ...th, width: "38%" }}>Vendor Remarks</th>
                </tr>
              </thead>
              <tbody>
                {groups[domain].map((q, idx) => {
                  const a = getA(q.id);
                  const answered = !!a.choice;
                  const atts = attsFor(q.id);
                  return (
                    <tr key={q.id} id={`vq-${q.id}`} style={{ borderTop: `1px solid ${C.slateLight}`, transition: "background .4s", background: highlightId === q.id ? "#FEF3C7" : "transparent" }}>
                      <td style={{ ...td, color: C.slate, fontWeight: 700, borderLeft: !answered && !submitted ? `3px solid ${C.amber}` : "3px solid transparent" }}>{idx + 1}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, color: C.navy }}>{q.text} <span style={{ color: C.rose }}>*</span></div>
                        {!answered && !submitted && <span style={{ fontSize: 11, color: C.amber, fontWeight: 700, marginRight: 10 }}>⚠ Pending</span>}
                        {!submitted && (
                          <button type="button" onClick={() => handleHelp(q)} style={{ marginTop: 4, background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}>
                            {helpLoading === q.id ? "💡 Thinking…" : help[q.id] ? "💡 Hide help" : "💡 Help me answer"}
                          </button>
                        )}
                        {help[q.id] && (
                          <div style={{ marginTop: 6, fontSize: 12, color: C.navyMid, background: "#F3F0FF", border: `1px solid #E5DEFF`, borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
                            <b style={{ color: C.accent }}>🤖 AI suggestion</b>
                            <div style={{ marginTop: 4 }}>{help[q.id]}</div>
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <select value={a.choice} disabled={submitted} onChange={e => setField(q.id, "choice", e.target.value)}
                          style={{ padding: 8, borderRadius: 4, border: `1px solid ${answered ? C.border : C.amber}`, background: submitted ? C.slateLight : "white", width: "100%" }}>
                          <option value="">— select —</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="NA">NA</option>
                        </select>
                      </td>
                      <td style={td}>
                        <textarea value={a.response} disabled={submitted} onChange={e => setField(q.id, "response", e.target.value)} maxLength={8000}
                          style={{ width: "100%", height: 54, padding: 8, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 4, background: submitted ? C.slateLight : "white" }} />
                        <div style={{ marginTop: 4, fontSize: 12 }}>
                          {atts.map((e, i) => <a key={i} href={`http://localhost:5000/api/admin/evidence/${encodeURIComponent(e.stored)}`} target="_blank" rel="noreferrer" style={{ color: C.accent, marginRight: 10 }}>📎 {e.name}</a>)}
                          {!submitted && <label style={{ cursor: "pointer", color: C.accent, fontWeight: 600 }}>＋ Add attachment<input type="file" onChange={e => handleEvidence(e, q.id)} style={{ display: "none" }} /></label>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ));
      })()}

      {qEnabled && total > 0 && !submitted && (
        <div style={{ marginTop: 8 }}>
          {/* requirement summary */}
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, marginBottom: 10 }}>
            <span style={{ color: choiceOk ? C.green : C.rose, fontWeight: 600 }}>{choiceOk ? "✓" : "✗"} Vendor Response {pct}% <span style={{ color: C.navyLight, fontWeight: 400 }}>(need 100%)</span></span>
            <span style={{ color: remarkOk ? C.green : C.rose, fontWeight: 600 }}>{remarkOk ? "✓" : "✗"} Vendor Remarks {remarkPct}% <span style={{ color: C.navyLight, fontWeight: 400 }}>(need 98%)</span></span>
            <span style={{ color: attachOk ? C.green : C.rose, fontWeight: 600 }}>{attachOk ? "✓" : "✗"} Attachments {attachPct}% <span style={{ color: C.navyLight, fontWeight: 400 }}>(need 98%)</span></span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!complete && (
              <button onClick={() => setShowBlockers(true)} style={{ background: "white", color: C.amber, border: `1px solid ${C.amber}`, padding: 14, borderRadius: 6, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                ⚠ Why can't I submit? ({blockers.length})
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!complete}
              title={complete ? "" : "Complete the response, remarks (98%) and attachments (98%) to enable submit"}
              style={{ flex: 1, background: complete ? C.accent : C.slate, color: "white", padding: 14, border: "none", borderRadius: 6, fontWeight: 700, cursor: complete ? "pointer" : "not-allowed" }}>
              {complete ? "Final Submit" : "Final Submit — requirements not met"}
            </button>
          </div>
        </div>
      )}

      </div>{/* end left column */}

      {/* ── RIGHT PROGRESS PANEL ── */}
      {qEnabled && total > 0 && !submitted && (
        <div style={{ width: 250, position: "sticky", top: 0, flexShrink: 0, background: "white", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.slateLight}`, fontWeight: 700, color: C.navy }}>📊 Progress Report</div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, fontSize: 13, borderBottom: `1px solid ${C.slateLight}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>🟢 Filled</span><b style={{ color: C.green }}>{filledN}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>🟠 Partially filled</span><b style={{ color: C.amber }}>{partialN}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>🔴 Pending</span><b style={{ color: C.rose }}>{pendingN}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.slateLight}`, paddingTop: 6 }}><span>Total</span><b>{total}</b></div>
          </div>
          <div style={{ padding: "8px 12px 4px", fontSize: 11, color: C.navyLight }}>Needs attention — click to jump</div>
          <div style={{ overflowY: "auto", padding: "0 8px 10px" }}>
            {questions.filter(q => statusOf(q) !== "filled").length === 0
              ? <div style={{ padding: 10, color: C.green, fontSize: 12, fontWeight: 600 }}>All questions fully filled ✓</div>
              : questions.filter(q => statusOf(q) !== "filled").map(q => {
                const s = statusOf(q);
                const col = s === "pending" ? C.rose : C.amber;
                return (
                  <div key={q.id} onClick={() => goToQuestion(q.id)} title={q.text}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", cursor: "pointer", borderRadius: 6, fontSize: 12 }}
                    onMouseEnter={e => e.currentTarget.style.background = C.slateLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: col, flexShrink: 0 }} />
                    <span style={{ color: C.navyMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.id}: {q.text}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* BLOCKERS MODAL */}
      {showBlockers && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 60, padding: 20 }}>
          <div style={{ background: "white", borderRadius: 10, width: 600, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ margin: 0, color: C.navy }}>What's blocking submission</h3>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, marginTop: 8 }}>
                <span style={{ color: choiceOk ? C.green : C.rose }}>Vendor Response: {answeredCount}/{total} (need 100%)</span>
                <span style={{ color: remarkOk ? C.green : C.rose }}>Vendor Remarks: {remarkCount}/{total} (need 98%)</span>
                <span style={{ color: attachOk ? C.green : C.rose }}>Attachments: {attachCount}/{total} (need 98%)</span>
              </div>
            </div>
            <div style={{ padding: "8px 22px", overflowY: "auto", flex: 1 }}>
              {blockers.length === 0
                ? <p style={{ color: C.green }}>All requirements met — you can submit.</p>
                : blockers.map(({ q, missing }, i) => (
                  <div key={q.id} onClick={() => goToQuestion(q.id)} title="Go to this question"
                    style={{ padding: "10px 8px", borderBottom: i < blockers.length - 1 ? `1px solid ${C.slateLight}` : "none", cursor: "pointer", borderRadius: 6 }}
                    onMouseEnter={e => e.currentTarget.style.background = C.slateLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: C.slate, fontWeight: 700 }}>{q.id} · {q.domain}</div>
                      <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>Go to question →</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.accent, margin: "2px 0 6px 0", textDecoration: "underline" }}>{q.text}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {missing.map(m => <span key={m} style={{ fontSize: 11, background: C.roseLight, color: C.rose, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Missing: {m}</span>)}
                    </div>
                  </div>
                ))}
            </div>
            <div style={{ padding: "12px 22px", borderTop: `1px solid ${C.border}`, textAlign: "right" }}>
              <button onClick={() => setShowBlockers(false)} style={{ background: C.accent, color: "white", border: "none", padding: "10px 22px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
