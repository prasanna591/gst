import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Cloud, CloudOff, CloudUpload, RefreshCw, ShieldCheck } from "lucide-react";
import api from "./api";
import { useAuth } from "./authContext";

export default function SettingsPage() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function notify(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function submit(event) {
    event.preventDefault();

    if (next !== confirm) {
      return notify("error", "The new password and the confirmation do not match.");
    }

    setSaving(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      notify("success", "Password changed. Use it the next time you sign in.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      const detail = err.response?.data?.detail;
      notify(
        "error",
        typeof detail === "string"
          ? detail
          : "Could not change the password. It needs 8 to 72 characters."
      );
    } finally {
      setSaving(false);
    }
  }

  const type = show ? "text" : "password";

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Settings</span>
          <h1>Settings</h1>
          <p>Your account details and password.</p>
        </div>
      </header>

      <section className="settings-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your account</h2>
              <p>Ask an administrator if any of these need to change.</p>
            </div>
          </div>
          <dl className="detail-grid">
            <div className="wide"><dt>Full name</dt><dd>{user.full_name}</dd></div>
            <div className="wide"><dt>Email</dt><dd>{user.email}</dd></div>
            <div className="wide"><dt>Role</dt><dd>{user.role}</dd></div>
          </dl>
        </div>

        <form className="panel" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h2>Change password</h2>
              <p>Use at least 8 characters.</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              title={show ? "Hide passwords" : "Show passwords"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <label>
              Current password
              <input
                type={type}
                required
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type={type}
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type={type}
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>

        {user?.role === "Admin" && <DriveSection notify={notify} />}
      </section>

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </main>
  );
}

function DriveSection({ notify }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef(null);

  const load = async () => {
    try {
      const r = await api.get("/api/sync/status");
      setSt(r.data);
      return r.data;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => {
      clearTimeout(timer);
      clearInterval(poll.current);
    };
  }, []);

  async function act(fn, ok) {
    setBusy(true);
    try {
      await fn();
      if (ok) notify("success", ok);
      await load();
    } catch (e) {
      const d = e.response?.data?.detail;
      notify("error", typeof d === "string" ? d : "Failed. Please try again.");
    } finally { setBusy(false); }
  }

  function connect() {
    act(() => api.post("/api/sync/connect"), "Finish the sign-in in your browser, then come back.");
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      const s = await load();
      if (s?.connected) {
        clearInterval(poll.current);
        notify("success", "Google account connected.");
      }
    }, 2500);
  }

    if (!st || !st.supported) return null;

  const state = !st.connected ? "" : st.status === "error" ? "bad" : st.pending ? "wait" : "ok";
  const title = !st.connected ? "Not connected"
    : st.status === "error" ? "Sync problem"
    : st.pending ? "Changes waiting to upload"
    : "Everything is backed up";
  const sub = !st.connected ? "Connect your Google account to turn on automatic backup."
    : st.status === "error" ? (st.error || "Please try Sync now.")
    : st.email;
  const Icon = !st.connected ? CloudOff : state === "wait" ? CloudUpload : Cloud;

  return (
    <div className="panel gd">
      <div className="gd-head">
        <div className="gd-logo"><Cloud size={22} /></div>
        <div>
          <h2>Google Drive backup and sync</h2>
          <p>Keep your data safe and use it on more than one laptop.</p>
        </div>
      </div>

      <div className="gd-body">
        <div className={`gd-status ${state}`}>
          <div className="ico"><Icon size={20} /></div>
          <div className="txt">
            <strong>{title}</strong>
            <span>{sub}</span>
          </div>
          {!st.connected && (
            <button className="primary-btn" onClick={connect} disabled={busy || !st.configured}>
              Connect Google
            </button>
          )}
        </div>

        {st.connected ? (
          <>
            <div className="gd-grid">
              <div className="gd-cell"><small>Connected account</small><b>{st.email}</b></div>
              <div className="gd-cell"><small>Last sync</small><b>{st.last_sync || "Not yet"}</b></div>
              <div className="gd-cell"><small>Automatic sync</small><b>On, every 30 seconds</b></div>
              <div className="gd-cell"><small>Works offline</small><b>Yes, syncs when online</b></div>
            </div>
            <div className="gd-actions">
              <button className="primary-btn" disabled={busy}
                onClick={() => act(() => api.post("/api/sync/now"), "Sync finished.")}>
                <RefreshCw size={16} /> Sync now
              </button>
              <button className="secondary-btn" disabled={busy}
                onClick={() => window.confirm("Stop syncing with this Google account?")
                  && act(() => api.post("/api/sync/disconnect"), "Disconnected.")}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <ol className="gd-steps">
            <li><b>1</b><span>Click <strong>Connect Google</strong> and sign in with your Google account.</span></li>
            <li><b>2</b><span>Your data is saved to your own Google Drive automatically.</span></li>
            <li><b>3</b><span>On another laptop, install the app and choose <strong>Restore from Google Drive</strong> on the first screen.</span></li>
          </ol>
        )}
      </div>

      <div className="gd-foot">
        <ShieldCheck size={16} />
        Only this app can see its backup. Your other Google Drive files are never accessed.
      </div>
    </div>
  );
}