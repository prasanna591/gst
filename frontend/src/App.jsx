import { useEffect, useState } from "react";
import '@fontsource-variable/inter';
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import Auditors from "./Auditors";
import Filings from "./Filings";
import Fees from "./Fees";
import Tasks from "./Tasks";
import ImportantDates from "./ImportantDates";
import Dashboard from "./Dashboard";
import Documents from "./Documents";
import UsersPage from "./Users";
import SettingsPage from "./Settings";
import NotificationBell from "./NotificationBell";
import SyncStatus from "./SyncStatus";
import NavBadge from "./NavBadge";
import ClientDetail from "./ClientDetail";
import { useAuth } from "./authContext";
import {
  Users, Search, Plus, LayoutDashboard, FileText, CalendarDays, IndianRupee, ListChecks, Gift,
  Settings, RefreshCw, X, Pencil, Eye, CheckCircle2, AlertCircle, UserCheck, LogOut, ShieldCheck, Menu,
} from "lucide-react";
import api from "./api";
import "./App.css";

const emptyForm = {
  client_name: "", business_name: "", email: "", phone: "",
  address: "", gstin: "", pan: "", business_registration: "", notes: "",
  date_of_birth: "", is_active: true, auditor_id: "",
};

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;

export default function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onResize = () => { if (window.innerWidth > 760) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewClient, setViewClient] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [auditors, setAuditors] = useState([]);
  const [auditorFilter, setAuditorFilter] = useState("all");
  const [pendingFilings, setPendingFilings] = useState(null);
  const [docCount, setDocCount] = useState(null);

  function notify(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadClients() {
    setLoading(true);
    try {
      const response = await api.get("/api/clients/");
      setClients(response.data);
    } catch {
      notify("error", "Unable to load clients. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditors() {
    try {
      const response = await api.get("/api/auditors/");
      setAuditors(response.data);
    } catch {
      notify("error", "Unable to load auditors.");
    }
  }

  function auditorName(id) {
    return auditors.find((a) => a.id === id)?.name || "—";
  }

  useEffect(() => {
    loadClients();
    loadAuditors();
    api.get("/api/filings/").then((r) => setPendingFilings(r.data.filter((f) => f.status !== "Filed").length)).catch(() => {});
    api.get("/api/documents/").then((r) => setDocCount(r.data.length)).catch(() => {});
  }, []);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(client) {
    setViewClient(null);
    setEditingId(client.id);
    setForm({
      client_name: client.client_name || "",
      business_name: client.business_name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      gstin: client.gstin || "",
      pan: client.pan || "",
      business_registration: client.business_registration || "",
      notes: client.notes || "",
      date_of_birth: client.date_of_birth || "",
      is_active: client.is_active !== false,
      auditor_id: client.auditor_id ? String(client.auditor_id) : "",
    });
    setShowForm(true);
  }

  function setField(key, value) {
    const upper = key === "gstin" || key === "pan";
    setForm({ ...form, [key]: upper ? value.toUpperCase() : value });
  }

  async function saveClient(event) {
    event.preventDefault();

    if (form.gstin.trim() && !GSTIN_RE.test(form.gstin.trim())) {
      return notify("error", "GSTIN must be 15 characters, for example 33ABCDE1234F1Z5.");
    }
    if (form.pan.trim() && !PAN_RE.test(form.pan.trim())) {
      return notify("error", "PAN must be 10 characters, for example ABCDE1234F.");
    }

    setSaving(true);
    try {
      const { is_active, auditor_id, ...textFields } = form;
      const payload = {
        ...Object.fromEntries(
          Object.entries(textFields).map(([k, v]) => [k, v.trim() || null])
        ),
        is_active,
        auditor_id: auditor_id ? Number(auditor_id) : null,
      };
      if (editingId) {
        await api.put(`/api/clients/${editingId}`, payload);
      } else {
        await api.post("/api/clients/", payload);
      }
      notify("success", editingId ? "Client updated." : "Client added.");
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await loadClients();
    } catch (err) {
      const detail = err.response?.data?.detail;
      notify(
        "error",
        typeof detail === "string"
          ? detail
          : "Could not save the client. Please check the details."
      );
    } finally {
      setSaving(false);
    }
  }

  const q = search.toLowerCase();
  const filteredClients = clients.filter((c) => {
    const matchesSearch = [c.client_name, c.business_name, c.gstin, c.pan, c.phone, c.email]
      .some((v) => (v || "").toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? c.is_active : !c.is_active);
    const matchesAuditor =
      auditorFilter === "all" ||
      (auditorFilter === "none" ? !c.auditor_id : String(c.auditor_id) === auditorFilter);
    return matchesSearch && matchesStatus && matchesAuditor;
  });

  const activeCount = clients.filter((c) => c.is_active).length;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const statCards = [
    { label: "Total clients", value: clients.length, note: "All registered clients", icon: Users, tone: "blue", card: "" },
    { label: "Active clients", value: activeCount, note: "Currently being served", icon: Users, tone: "green", card: "c-green" },
    { label: "Pending filings", value: pendingFilings ?? "—", note: "Returns not yet filed", icon: CalendarDays, tone: "violet", card: "c-violet" },
    { label: "Documents", value: docCount ?? "—", note: "Files stored for clients", icon: FileText, tone: "orange", card: "c-gold" },
  ];

  const detailRows = viewClient && [
    ["Business name", viewClient.business_name],
    ["Phone", viewClient.phone],
    ["Email", viewClient.email],
    ["GSTIN", viewClient.gstin],
    ["PAN", viewClient.pan],
    ["Date of birth", viewClient.date_of_birth],
    ["Auditor", auditorName(viewClient.auditor_id)],
    ["Business registration", viewClient.business_registration],
    ["Address", viewClient.address, true],
    ["Notes", viewClient.notes, true],
  ];

  if (!user) return null;

  return (
    <div className="app-shell">
      <div className="mobile-bar">
        <div className="brand">
          <div className="brand-icon">G</div>
          <div><strong>GST Office</strong><small>Client management</small></div>
        </div>
        <button
          className="icon-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="app-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} />
        </button>
      </div>
      <div
        className={`drawer-backdrop ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? "open" : ""}`} id="app-drawer">
        <button
          className="icon-btn sm drawer-close"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        >
          <X size={18} />
        </button>
        <div className="brand">
          <div className="brand-icon">G</div>
          <div><strong>GST Office</strong><small>Client management</small></div>
        </div>

        <p className="nav-heading">Workspace</p>
        <nav onClick={() => setMenuOpen(false)}>
          <NavLink className="nav-item" to="/" end><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink className="nav-item" to="/dates"><Gift size={18} /> Important dates</NavLink>
          <NavLink className="nav-item" to="/tasks"><ListChecks size={18} /> Tasks <NavBadge kind="tasks" /></NavLink>
          <NavLink className="nav-item" to="/clients"><Users size={18} /> Clients</NavLink>
          <NavLink className="nav-item" to="/auditors"><UserCheck size={18} /> Auditors</NavLink>
          <NavLink className="nav-item" to="/filings"><CalendarDays size={18} /> GST filings</NavLink>
          <NavLink className="nav-item" to="/fees"><IndianRupee size={18} /> Fees <NavBadge kind="fees" /></NavLink>
          <NavLink className="nav-item" to="/documents"><FileText size={18} /> Documents</NavLink>
          <NavLink className="nav-item" to="/settings"><Settings size={18} /> Settings</NavLink>
          {user?.role === "Admin" && (
            <NavLink className="nav-item" to="/users"><ShieldCheck size={18} /> Users</NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <SyncStatus />
          <div className="user-card">
            <div className="user-avatar">
              {(user?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <strong>{user?.full_name || "User"}</strong>
              <small>{user?.role || "Staff"}</small>
            </div>
            <button className="icon-btn sm logout-btn" title="Sign out" onClick={logout}>
              <LogOut size={15} />
              <span className="logout-label">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {pathname.startsWith("/clients/") ? (
        <ClientDetail />
      ) : pathname === "/auditors" ? (
        <Auditors />
      ) : pathname === "/filings" ? (
        <Filings />
      ) : pathname === "/fees" ? (
        <Fees />
      ) : pathname === "/tasks" ? (
        <Tasks />
      ) : pathname === "/dates" ? (
        <ImportantDates />
      ) : pathname === "/settings" ? (
        <SettingsPage />
      ) : pathname === "/users" && user?.role === "Admin" ? (
        <UsersPage />
      ) : pathname === "/documents" ? (
        <Documents />
      ) : pathname === "/" ? (
        <Dashboard />
      ) : (
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="crumb">Workspace / Clients</span>
            <h1>Client management</h1>
            <p>Manage client information and business records.</p>
          </div>
          <div className="topbar-actions">
            <span className="date-chip"><CalendarDays size={15} /> {today}</span>
            <NotificationBell />
            <button className="primary-btn" onClick={openAddForm}>
              <Plus size={18} /> Add client
            </button>
          </div>
        </header>

        <section className="stats-grid" id="dashboard">
          {statCards.map(({ label, value, note, icon: Icon, tone, card }) => (
            <article className={`stat-card ${card}`} key={label}>
              <div className="stat-top">
                <span>{label}</span>
                <div className={`stat-icon ${tone}`}><Icon /></div>
              </div>
              <strong>{loading && typeof value === "number" ? "…" : value}</strong>
              <small>{note}</small>
            </article>
          ))}
        </section>

        <section className="panel" id="clients">
          <div className="panel-heading">
            <div>
              <h2>All clients</h2>
              <p>Search by name, GSTIN, PAN, phone or email.</p>
            </div>
            <button className="icon-btn" onClick={loadClients} title="Refresh">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients..."
              />
            </div>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              className="filter-select"
              value={auditorFilter}
              onChange={(e) => setAuditorFilter(e.target.value)}
            >
              <option value="all">All auditors</option>
              <option value="none">Not assigned</option>
              {auditors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="table-wrap">
              {[0, 1, 2].map((i) => (
                <div className="skeleton-row" key={i}>
                  <div className="sk circle" />
                  <div className="sk" style={{ width: "22%" }} />
                  <div className="sk" style={{ width: "26%" }} />
                  <div className="sk" style={{ width: "16%" }} />
                </div>
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><Users size={26} /></div>
              <h3>{clients.length === 0 ? "No clients yet" : "No matching clients"}</h3>
              <p>
                {clients.length === 0
                  ? "Add your first client to start tracking GST work."
                  : "Try a different name, GSTIN, PAN or phone number."}
              </p>
              {clients.length === 0 && (
                <button className="primary-btn" onClick={openAddForm}>
                  <Plus size={18} /> Add client
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Client</th><th>Business</th><th>GSTIN</th>
                      <th>Phone</th><th>Email</th><th>Auditor</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          <div className="client-cell">
                            <div className={`avatar av-${client.id % 5}`}>
                              {(client.client_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <Link className="name-link" to={`/clients/${client.id}`}>
                                <strong>{client.client_name}</strong>
                              </Link>
                              <small>ID: {client.id}</small>
                            </div>
                          </div>
                        </td>
                        <td>{client.business_name || "—"}</td>
                        <td className="mono">{client.gstin || "—"}</td>
                        <td className="mono">{client.phone || "—"}</td>
                        <td>{client.email || "—"}</td>
                        <td>{client.auditor_id ? auditorName(client.auditor_id) : <span className="muted">Not assigned</span>}</td>
                        <td>
                          <span className={`badge ${client.is_active ? "badge-active" : "badge-inactive"}`}>
                            {client.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn sm" title="View" onClick={() => setViewClient(client)}>
                              <Eye size={15} />
                            </button>
                            <button className="icon-btn sm" title="Edit" onClick={() => openEditForm(client)}>
                              <Pencil size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-footer">
                Showing {filteredClients.length} of {clients.length} clients
              </p>
            </>
          )}
        </section>
      </main>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>{editingId ? "Edit client" : "Add new client"}</h2>
                <p>Enter the client's business details.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowForm(false)} title="Close"><X /></button>
            </div>
            <form onSubmit={saveClient}>
              <div className="form-grid">
                {[
                  ["client_name", "Client name *", true],
                  ["business_name", "Business name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["gstin", "GSTIN"],
                  ["pan", "PAN"],
                  ["business_registration", "Business registration"],
                ].map(([key, label, required]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={Boolean(required)}
                      value={form[key]}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </label>
                ))}
                <label>
  Date of birth
  <input
    type="date"
    value={form.date_of_birth}
    onChange={(e) => setField("date_of_birth", e.target.value)}
  />
</label>
<label>
  Status
  <select
    value={form.is_active ? "active" : "inactive"}
    onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
  >
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </select>
</label>
<label className="full-width">
  Responsible auditor
  <select
    value={form.auditor_id}
    onChange={(e) => setForm({ ...form, auditor_id: e.target.value })}
  >
    <option value="">Not assigned</option>
    {auditors
      .filter((a) => a.is_active)
      .map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}{a.firm_name ? ` (${a.firm_name})` : ""}
        </option>
      ))}
  </select>
</label>
                <label className="full-width">
                  Address
                  <input value={form.address} onChange={(e) => setField("address", e.target.value)} />
                </label>
                <label className="full-width">
                  Notes
                  <textarea rows="3" value={form.notes} onChange={(e) => setField("notes", e.target.value)} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update client" : "Save client"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* View modal */}
      {viewClient && (
        <div className="modal-backdrop" onClick={() => setViewClient(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>Client details</h2>
              <button className="icon-btn" onClick={() => setViewClient(null)} title="Close"><X /></button>
            </div>
            <div className="detail-head">
              <div className={`avatar av-${viewClient.id % 5}`}>
                {(viewClient.client_name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <h3>{viewClient.client_name}</h3>
                <p>ID: {viewClient.id} · <span className={`badge ${viewClient.is_active ? "badge-active" : "badge-inactive"}`}>
                  {viewClient.is_active ? "Active" : "Inactive"}
                </span></p>
              </div>
            </div>
            <dl className="detail-grid">
              {detailRows.map(([label, value, wide]) => (
                <div key={label} className={wide ? "wide" : ""}>
                  <dt>{label}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <div className="modal-actions">
              <button
                className="secondary-btn"
                onClick={() => { const id = viewClient.id; setViewClient(null); navigate(`/clients/${id}`); }}
              >
                Full history
              </button>
              <button className="secondary-btn" onClick={() => setViewClient(null)}>Close</button>
              <button className="primary-btn" onClick={() => openEditForm(viewClient)}>
                <Pencil size={16} /> Edit client
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
