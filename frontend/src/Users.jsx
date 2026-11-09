import { useEffect, useState } from "react";
import {
  Users, RefreshCw, AlertCircle, KeyRound, X, CheckCircle2, Search,
  ShieldCheck, UserCheck, UserX, Ban, RotateCcw,
} from "lucide-react";
import api from "./api";
import { useAuth } from "./authContext";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api.get("/api/users/");
      setUsers(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function notify(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function submitReset(e) {
    e.preventDefault();
    if (pw.length < 8) return setModalError("Password must be at least 8 characters.");
    setBusy(true);
    setModalError("");
    try {
      await api.post(`/api/auth/admin-reset/${target.id}`, { new_password: pw });
      notify("success", `Password changed for ${target.full_name}.`);
      setTarget(null);
    } catch (err) {
      const d = err.response?.data?.detail;
      setModalError(typeof d === "string" ? d : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    try {
      await api.put(`/api/users/${u.id}`, { full_name: u.full_name, role: u.role, is_active: !u.is_active });
      notify("success", `${u.full_name} ${u.is_active ? "disabled" : "enabled"}.`);
      await load();
    } catch (err) {
      const d = err.response?.data?.detail;
      notify("error", typeof d === "string" ? d : "Could not update this user.");
    }
  }

  const admins = users.filter((u) => u.role === "Admin").length;
  const disabled = users.filter((u) => !u.is_active).length;
  const q = search.toLowerCase();
  const shown = users.filter((u) => [u.full_name, u.email].some((v) => (v || "").toLowerCase().includes(q)));

  const cards = [
    { label: "Total users", value: users.length, note: "All accounts", icon: Users, tone: "blue", card: "" },
    { label: "Admins", value: admins, note: "Full access", icon: ShieldCheck, tone: "violet", card: "c-violet" },
    { label: "Staff", value: users.length - admins, note: "Standard access", icon: UserCheck, tone: "green", card: "c-green" },
    { label: "Disabled", value: disabled, note: "Cannot sign in", icon: UserX, tone: "orange", card: "c-gold" },
  ];

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Users</span>
          <h1>User management</h1>
          <p>Reset passwords and enable or disable accounts. New staff can sign up from the sign-in page.</p>
        </div>
      </header>

      <section className="stats-grid">
        {cards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <article className={`stat-card ${card}`} key={label}>
            <div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon /></div></div>
            <strong>{loading ? "…" : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-tools">
          <div className="search-box">
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." />
          </div>
          <button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={18} /></button>
        </div>

        {loading ? <p>Loading users...</p>
          : error ? <p role="alert"><AlertCircle size={17} /> {error}</p>
          : shown.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Users size={26} /></div>
              <h3>No matching users</h3><p>Try a different name or email.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {shown.map((u) => {
                    const mine = u.id === me?.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <div className="person">
                            <div className={`avatar av-${u.id % 5}`}>{(u.full_name || "?").charAt(0).toUpperCase()}</div>
                            <div>
                              <strong>{u.full_name}{mine && <span className="you-tag">You</span>}</strong>
                              <small>{u.email}</small>
                            </div>
                          </div>
                        </td>
                        <td><span className={`pill ${u.role === "Admin" ? "pill-admin" : "pill-staff"}`}>{u.role}</span></td>
                        <td><span className={`badge ${u.is_active ? "badge-active" : "badge-inactive"}`}>{u.is_active ? "Active" : "Disabled"}</span></td>
                        <td>
                          <div className="row-actions">
                            <button className="text-btn" onClick={() => { setTarget(u); setPw(""); setModalError(""); }}>
                              <KeyRound size={14} /> Reset password
                            </button>
                            {!mine && (
                              <button className={`text-btn ${u.is_active ? "danger" : "good"}`} onClick={() => toggleActive(u)}>
                                {u.is_active ? <><Ban size={14} /> Disable</> : <><RotateCcw size={14} /> Enable</>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        <p className="table-footer">Showing {shown.length} of {users.length} users</p>
      </section>

      {target && (
        <div className="modal-backdrop" onClick={() => setTarget(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>Reset password</h2>
                <p>Set a new password for {target.full_name} ({target.email}).</p>
              </div>
              <button className="icon-btn" onClick={() => setTarget(null)} title="Close"><X /></button>
            </div>
            <form onSubmit={submitReset}>
              <div className="form-grid">
                <label className="full-width">
                  New password (min 8 characters)
                  <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="off" />
                </label>
              </div>
              {modalError && <p role="alert" style={{ color: "#b91c1c" }}>{modalError}</p>}
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setTarget(null)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={busy}>{busy ? "Saving..." : "Change password"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </main>
  );
}