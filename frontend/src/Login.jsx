import { useState } from "react";
import { Eye, EyeOff, CalendarDays, Users, ShieldCheck } from "lucide-react";
import api from "./api";
import { useAuth } from "./authContext";
import ForgotPassword from "./ForgotPassword";

export default function Login() {
  const { login } = useAuth();
  const [forgot, setForgot] = useState(false);
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (forgot) return <ForgotPassword onBack={() => setForgot(false)} />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (signup) {
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (password !== confirm) return setError("Passwords do not match.");
    }
    setBusy(true);
    try {
      if (signup) {
        await api.post("/api/auth/register", {
          full_name: name.trim(), email: email.trim(), password,
        });
      }
      await login(email.trim(), password);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Something went wrong. Please check the details.");
      setBusy(false);
    }
  }

  const toggle = (e) => { e.preventDefault(); setSignup(!signup); setError(""); };

  return (
    <div className="login-page">
      <aside className="login-side">
        <div className="brand">
          <div className="brand-icon">G</div>
          <div><strong>GST Office</strong><small>Client management</small></div>
        </div>
        <div>
          <h2>Every client and every GST deadline in one place.</h2>
          <ul>
            <li><Users size={18} /> Client and auditor records</li>
            <li><CalendarDays size={18} /> Filing status and due dates</li>
            <li><ShieldCheck size={18} /> Secure, role-based access</li>
          </ul>
        </div>
<p className="login-foot">Works offline. Backs up to your Google Drive.</p>      </aside>

      <main className="login-main">
        <form className="login-card" onSubmit={submit}>
          <div className="login-brand">
            <div className="brand-icon">G</div>
            <div><strong>GST Office</strong><small>Client management</small></div>
          </div>
          <h1>{signup ? "Sign up" : "Sign in"}</h1>
          <p>{signup ? "Create your account to get started." : "Sign in with your email and password."}</p>

          {error && <div className="login-error" role="alert">{error}</div>}

          {signup && (
            <label>
              Full name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}

          <label>
            Email
            <input type="email" required autoFocus autoComplete="username"
                   value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label>
            Password
            <div className="password-field">
              <input type={show ? "text" : "password"} required
                     autoComplete={signup ? "new-password" : "current-password"}
                     value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="eye-btn" onClick={() => setShow(!show)}
                      title={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {signup && (
            <label>
              Confirm password
              <input type={show ? "text" : "password"} required
                     value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          )}

          {!signup && (
            <p style={{ textAlign: "right", margin: "-6px 0 14px", fontSize: 13 }}>
              <a href="#/" onClick={(e) => { e.preventDefault(); setForgot(true); }}>Forgot password?</a>
            </p>
          )}

          <button type="submit" className="primary-btn login-submit" disabled={busy}>
            {busy ? "Please wait..." : signup ? "Sign up" : "Sign in"}
          </button>

          <p style={{ textAlign: "center", marginTop: 14, fontSize: 14 }}>
            {signup ? "Already have an account? " : "New here? "}
            <a href="#/" onClick={toggle}>{signup ? "Sign in" : "Create an account"}</a>
          </p>
        </form>
      </main>
    </div>
  );
}