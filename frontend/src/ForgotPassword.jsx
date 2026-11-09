import { useState } from "react";
import { Eye, EyeOff, Mail, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck, Lock, CalendarDays } from "lucide-react";
import api from "./api";

export default function ForgotPassword({ onBack }) {
  const [method, setMethod] = useState("code");      // "code" or "key"
  const [step, setStep] = useState(1);               // 1 email, 2 code + password, 3 done
  const [f, setF] = useState({ email: "", code: "", key: "", pw: "", pw2: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const fail = (e, fallback) => {
    const d = e.response?.data?.detail;
    setError(typeof d === "string" ? d : fallback);
  };

  function pickMethod(m) { setMethod(m); setStep(1); setError(""); setInfo(""); }

  async function sendCode(e) {
    e.preventDefault(); setError(""); setInfo(""); setBusy(true);
    try {
      await api.post("/api/auth/forgot-password", { email: f.email.trim() });
      setInfo(`If ${f.email.trim()} has an account, a 6-digit code has been sent. Check Spam too.`);
      setStep(2);
    } catch (err) { fail(err, "Could not send the code. Check your internet connection."); }
    finally { setBusy(false); }
  }

  async function resetPassword(e) {
    e.preventDefault(); setError("");
    if (f.pw.length < 8) return setError("Password must be at least 8 characters.");
    if (f.pw !== f.pw2) return setError("Passwords do not match.");
    setBusy(true);
    try {
      if (method === "code") {
        await api.post("/api/auth/reset-password", { email: f.email.trim(), code: f.code.trim(), new_password: f.pw });
      } else {
        await api.post("/api/auth/reset-with-recovery-key",
          { email: f.email.trim(), recovery_key: f.key.trim(), new_password: f.pw });
      }
      setStep(3);
    } catch (err) { fail(err, "Please check the details and try again."); }
    finally { setBusy(false); }
  }

  const showPasswordForm = method === "key" || step === 2;

  return (
    <div className="login-page">
      <aside className="login-side">
        <div className="brand">
          <div className="brand-icon">G</div>
          <div><strong>GST Office</strong><small>Client management</small></div>
        </div>
        <div>
          <h2>Locked out? You can get back in within a minute.</h2>
          <ul>
            <li><Mail size={18} /> Get a 6-digit code by email</li>
            <li><KeyRound size={18} /> Or use your admin recovery key</li>
            <li><ShieldCheck size={18} /> Your data is never lost</li>
          </ul>
        </div>
        <p className="login-foot">Works offline. Email needs internet only for this step.</p>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-icon">G</div>
            <div><strong>GST Office</strong><small>Client management</small></div>
          </div>

          {step === 3 ? (
              <div className="fp-done">
  <div className="big"><CheckCircle2 size={34} /></div>
  <h1>Password changed</h1>
  <p>Your password has been updated. Use your new password to sign in.</p>
  <button className="primary-btn login-submit" onClick={onBack}>Go to sign in</button>
  <span className="fp-meta">Keep your new password somewhere safe.</span>
</div>
          ) : (
            <>
              <h1>Reset your password</h1>
              <p>{method === "code"
                ? "We will email a 6-digit code to your account."
                : "Admins can reset with the recovery key saved at setup."}</p>

              <div className="fp-switch">
                <button type="button" className={method === "code" ? "on" : ""} onClick={() => pickMethod("code")}>
                  Email code
                </button>
                <button type="button" className={method === "key" ? "on" : ""} onClick={() => pickMethod("key")}>
                  Recovery key
                </button>
              </div>

              {method === "code" && (
                <div className="fp-steps">
                  <span className={step === 1 ? "on" : ""}><b>1</b> Email</span><i />
                  <span className={step === 2 ? "on" : ""}><b>2</b> New password</span>
                </div>
              )}

              {error && <div className="login-error" role="alert">{error}</div>}
              {info && step === 2 && <div className="fp-ok"><CheckCircle2 size={18} /> <span>{info}</span></div>}

              <form onSubmit={showPasswordForm ? resetPassword : sendCode}>
                <label>
                  Email
                  <input type="email" required autoFocus autoComplete="username" value={f.email}
                         disabled={method === "code" && step === 2}
                         onChange={(e) => set("email", e.target.value)} />
                </label>

                {method === "code" && step === 2 && (
                  <label>
                    6-digit code
                    <input className="fp-code" required inputMode="numeric" maxLength={6} placeholder="······"
                           value={f.code} onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} />
                  </label>
                )}

                {method === "key" && (
                  <label>
                    Recovery key
                    <input required placeholder="XXXX-XXXX-XXXX-XXXX" value={f.key}
                           onChange={(e) => set("key", e.target.value.toUpperCase())} />
                  </label>
                )}

                {showPasswordForm && (
                  <>
                    <label>
                      New password
                      <div className="password-field">
                        <input type={show ? "text" : "password"} required autoComplete="new-password"
                               placeholder="At least 8 characters" value={f.pw}
                               onChange={(e) => set("pw", e.target.value)} />
                        <button type="button" className="eye-btn" onClick={() => setShow(!show)}
                                title={show ? "Hide password" : "Show password"}>
                          {show ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>
                    <label>
                      Confirm new password
                      <input type={show ? "text" : "password"} required autoComplete="new-password"
                             value={f.pw2} onChange={(e) => set("pw2", e.target.value)} />
                    </label>
                  </>
                )}

                <button type="submit" className="primary-btn login-submit" disabled={busy}>
                  {busy ? "Please wait..."
                    : showPasswordForm ? "Change password" : "Send code"}
                </button>
              </form>

              {method === "code" && step === 2 && (
                <p className="fp-hint">
                  Did not get it? <a href="#/" onClick={(e) => { e.preventDefault(); setStep(1); setInfo(""); setError(""); }}>Send a new code</a>
                </p>
              )}
              <p className="fp-hint"><Lock size={12} style={{ verticalAlign: -2 }} /> Staff without email access can ask the admin to reset their password.</p>

              <a href="#/" className="fp-back" onClick={(e) => { e.preventDefault(); onBack(); }}>
                <ArrowLeft size={16} /> Back to sign in
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}