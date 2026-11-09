import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle2, FileText, Download,
} from "lucide-react";
import api from "./api";

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s.length === 10 ? s + "T00:00:00" : s).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtPeriod(p) {
  return new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short", year: "numeric",
  });
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getState(f) {
  if (f.status === "Filed") return "Filed";
  return f.due_date < todayStr() ? "Overdue" : "Pending";
}

const BADGE = { Filed: "badge-active", Pending: "badge-pending", Overdue: "badge-overdue" };

export default function ClientDetail() {
  const { pathname } = useLocation();
  const id = pathname.split("/")[2];

  const [client, setClient] = useState(null);
  const [auditor, setAuditor] = useState(null);
  const [filings, setFilings] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [c, a, f, d] = await Promise.all([
          api.get(`/api/clients/${id}`),
          api.get("/api/auditors/"),
          api.get("/api/filings/", { params: { client_id: id } }),
          api.get("/api/documents/", { params: { client_id: id } }),
        ]);
        if (cancelled) return;
        setClient(c.data);
        setAuditor(a.data.find((x) => x.id === c.data.auditor_id) || null);
        setFilings(f.data);
        setDocs(d.data);
      } catch (err) {
        if (cancelled) return;
        setError(
          err.response?.status === 404
            ? "This client does not exist."
            : "Unable to load this client. Check that the backend is running."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  async function download(doc) {
    try {
      const res = await api.get(`/api/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError("Could not download the document.");
    }
  }

  if (loading) {
    return (
      <main className="main-content">
        <p className="task-empty">Loading client...</p>
      </main>
    );
  }

  if (error && !client) {
    return (
      <main className="main-content">
        <Link className="back-link" to="/clients"><ArrowLeft size={16} /> Back to clients</Link>
        <div className="empty-state" style={{ marginTop: 20 }}>
          <h3>{error}</h3>
        </div>
      </main>
    );
  }

  const today = todayStr();
  const sorted = [...filings].sort((a, b) => b.due_date.localeCompare(a.due_date));
  const pending = filings.filter((f) => f.status !== "Filed" && f.due_date >= today).length;
  const overdue = filings.filter((f) => f.status !== "Filed" && f.due_date < today).length;
  const filed = filings.filter((f) => f.status === "Filed").length;

  const statCards = [
    { label: "Pending", value: pending, note: "Waiting to be filed", icon: Clock, tone: "orange", card: "c-gold" },
    { label: "Overdue", value: overdue, note: "Past the due date", icon: AlertTriangle, tone: "red", card: "c-red" },
    { label: "Filed", value: filed, note: "Completed returns", icon: CheckCircle2, tone: "green", card: "c-green" },
    { label: "Documents", value: docs.length, note: "Files stored", icon: FileText, tone: "blue", card: "" },
  ];

  const info = [
    ["Business name", client.business_name],
    ["Phone", client.phone],
    ["Email", client.email],
    ["GSTIN", client.gstin],
    ["PAN", client.pan],
    ["Business registration", client.business_registration],
    ["Date of birth", client.date_of_birth ? fmtDate(client.date_of_birth) : null],
    ["Responsible auditor", auditor?.name],
    ["Address", client.address, true],
    ["Notes", client.notes, true],
  ];

  return (
    <main className="main-content">
      <Link className="back-link" to="/clients"><ArrowLeft size={16} /> Back to clients</Link>

      <header className="topbar" style={{ marginTop: 14 }}>
        <div className="detail-head" style={{ margin: 0 }}>
          <div className={`avatar av-${client.id % 5}`}>
            {(client.client_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 style={{ margin: 0 }}>{client.client_name}</h1>
            <p>
              {client.business_name || "No business name"} ·{" "}
              <span className={`badge ${client.is_active ? "badge-active" : "badge-inactive"}`}>
                {client.is_active ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
        </div>
      </header>

      {error && <div className="login-error" style={{ marginBottom: 18 }}>{error}</div>}

      <section className="stats-grid">
        {statCards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <article className={`stat-card ${card}`} key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon ${tone}`}><Icon /></div>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>Client details</h2><p>Business and contact information.</p></div>
        </div>
        <dl className="detail-grid">
          {info.map(([label, value, wide]) => (
            <div key={label} className={wide ? "wide" : ""}>
              <dt>{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-heading">
          <div><h2>Filing history</h2><p>Latest due date first.</p></div>
          <Link className="secondary-btn" to="/filings">Manage filings</Link>
        </div>
        {sorted.length === 0 ? (
          <p className="task-empty">No filings recorded for this client yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th>Return</th><th>Period</th><th>Due date</th>
                  <th>Filed on</th><th>Status</th><th>ARN</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f) => {
                  const state = getState(f);
                  return (
                    <tr key={f.id}>
                      <td><strong>{f.return_type}</strong></td>
                      <td>{fmtPeriod(f.period)}</td>
                      <td>{fmtDate(f.due_date)}</td>
                      <td>{fmtDate(f.filed_date)}</td>
                      <td><span className={`badge ${BADGE[state]}`}>{state}</span></td>
                      <td className="mono">{f.arn || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-heading">
          <div><h2>Documents</h2><p>Files stored for this client.</p></div>
          <Link className="secondary-btn" to="/documents">Manage documents</Link>
        </div>
        {docs.length === 0 ? (
          <p className="task-empty">No documents uploaded for this client yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th>Document</th><th>Category</th><th>Filing</th>
                  <th>Size</th><th>Uploaded</th><th>Download</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const f = filings.find((x) => x.id === d.filing_id);
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.title}</strong>
                        <small>{d.original_filename}</small>
                      </td>
                      <td><span className="badge badge-pending">{d.category}</span></td>
                      <td>{f ? `${f.return_type} · ${fmtPeriod(f.period)}` : "—"}</td>
                      <td>{fmtSize(d.size_bytes)}</td>
                      <td>{fmtDate(d.uploaded_at)}</td>
                      <td>
                        <button className="icon-btn sm" title="Download" onClick={() => download(d)}>
                          <Download size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}