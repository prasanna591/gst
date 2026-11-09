import { useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  Check,
  Users,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import api from "./api";
import "./Setup.css";

function strength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  return score;
}

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

export default function Setup({ onDone }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [driveMsg, setDriveMsg] = useState("");
  const drivePoll = useRef(null);

  useEffect(() => () => clearInterval(drivePoll.current), []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const score = form.password ? strength(form.password) : 0;
  const matches = Boolean(form.confirm && form.password === form.confirm);

  async function restoreFromDrive() {
    clearInterval(drivePoll.current);
    setDriveMsg("Sign in to Google in your browser...");
    try {
      await api.post("/api/sync/setup/connect");
      drivePoll.current = setInterval(async () => {
        let s;
        try {
          s = (await api.get("/api/sync/status")).data;
        } catch {
          clearInterval(drivePoll.current);
          setDriveMsg("Could not check Google sign-in status.");
          return;
        }
        if (!s.connected) return;
        clearInterval(drivePoll.current);
        setDriveMsg("Loading your data...");
        try {
          await api.post("/api/sync/setup/pull");
          window.location.reload();
        } catch (e) {
          const d = e.response?.data?.detail;
          setDriveMsg(typeof d === "string" ? d : "Could not load the data.");
        }
      }, 2500);
    } catch {
      setDriveMsg("Could not start Google sign-in.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }

    if (form.password !== form.confirm) {
      return setError("Passwords do not match.");
    }

    setSaving(true);

    try {
      const res = await api.post("/api/setup/admin", {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setRecoveryKey(res.data.recovery_key);
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(
        typeof d === "string"
          ? d
          : "Could not create the account. Please check the details."
      );
    } finally {
      setSaving(false);
    }
  }

  if (recoveryKey) {
    return (
      <div className="setup-page" style={{ gridTemplateColumns: "1fr" }}>
        <main className="setup-main">
          <div className="setup-card" style={{ textAlign: "center" }}>
            <h2>Save your recovery key</h2>
            <p className="setup-sub">
              If you forget your password and have no internet, this key is the only way back in.
              Write it down and keep it safe. It is shown only once.
            </p>
            <div style={{ fontFamily: "monospace", fontSize: 24, letterSpacing: 2, padding: 16,
                          background: "#f1f5f9", borderRadius: 12, marginBottom: 16 }}>
              {recoveryKey}
            </div>
            <button className="setup-btn" onClick={onDone}>I have saved it, continue</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="setup-page">

<aside className="setup-brand">
  <div className="setup-brand-top">
    <div className="setup-logo">G</div>
    <div className="setup-brand-name">
      <strong>GST Office</strong>
      <small>Client management</small>
    </div>
  </div>

  <div className="setup-brand-message">
    <h1>Every client and every GST deadline in one place.</h1>
    <ul className="setup-brand-points">
      <li>
        <Users size={18} />
        <span>Client and auditor records</span>
      </li>
      <li>
        <CalendarDays size={18} />
        <span>Filing status and due dates</span>
      </li>
      <li>
        <ShieldCheck size={18} />
        <span>Secure, role-based access</span>
      </li>
    </ul>
  </div>

  <small className="setup-foot">Authorised staff only.</small>
</aside>


      <main className="setup-main">
        <form className="setup-card" onSubmit={submit} noValidate>
          <div className="setup-icon">
            <UserPlus size={22} />
          </div>

          <h2>Create administrator account</h2>
          <p className="setup-sub">
            This is a one-time setup. You will use these details to sign in
            and to add your staff.
          </p>

          <label className="sf">
            <span>Full name</span>
            <input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              autoFocus
              required
            />
          </label>

          <label className="sf">
            <span>Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              required
            />
            <small>You will sign in with this email.</small>
          </label>

          <label className="sf">
            <span>Password</span>
            <div className="sf-pw">
              <input
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="sf-eye"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {form.password && (
              <div className="meter">
                <div className="meter-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <i
                      key={i}
                      className={i <= score ? `on s${score}` : ""}
                    />
                  ))}
                </div>
                <small>{LABELS[score]}</small>
              </div>
            )}
          </label>

          <label className="sf">
            <span>Confirm password</span>
            <div className="sf-pw">
              <input
                type={show ? "text" : "password"}
                value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                placeholder="Re-enter the password"
                autoComplete="new-password"
                required
              />
              {matches && <Check size={18} className="sf-ok" />}
            </div>
          </label>

          {error && (
            <div className="setup-error" role="alert">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button className="setup-btn" disabled={saving}>
            {saving ? "Creating account..." : "Create account and continue"}
          </button>
          <button type="button" className="secondary-btn" style={{ width: "100%", marginTop: 10 }} onClick={restoreFromDrive}>
            Already used this app? Restore from Google Drive
          </button>
          {driveMsg && <p className="setup-note">{driveMsg}</p>}
        </form>
      </main>
    </div>
  );
}