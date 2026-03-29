import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────
//  🔥 FIREBASE CONFIG — replace with your own
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDKQnzG2J1wtWpENtFf2b9-XNnfte1niR0",
  authDomain: "attendtrack-3a9dc.firebaseapp.com",
  projectId: "attendtrack-3a9dc",
  storageBucket: "attendtrack-3a9dc.firebasestorage.app",
  messagingSenderId: "532454978373",
  appId: "1:532454978373:web:4137905a0e0bdd94b4c42c",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

const formatTime = (date) =>
  date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const formatDate = (dateStr) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const getAttendanceStatus = (window, now = new Date()) => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(window.start);
  const end = timeToMinutes(window.end);
  const late = timeToMinutes(window.lateAfter || window.start);

  if (currentMinutes < start) return "early";
  if (currentMinutes >= start && currentMinutes <= late) return "on_time";
  if (currentMinutes > late && currentMinutes <= end) return "late";
  return "closed";
};

// ─────────────────────────────────────────────
//  ICONS (inline SVG components)
// ─────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d={d} />
  </svg>
);

const Icons = {
  User: () => <Icon d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  Lock: () => <Icon d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />,
  Clock: () => <Icon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" />,
  Check: () => <Icon d="M20 6L9 17l-5-5" />,
  X: () => <Icon d="M18 6L6 18M6 6l12 12" />,
  LogOut: () => <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  Settings: () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  Users: () => <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  Calendar: () => <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
  Download: () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  Plus: () => <Icon d="M12 5v14M5 12h14" />,
  Fingerprint: () => <Icon d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4M5 19.5C5.5 18 6 15 6 12c0-1.7.7-3.2 1.8-4.3M10.1 20.8C10 20.5 10 20.3 10 20c0-2.4.8-4.7 2.2-6.5M14 21c0-2 .5-3.9 1.4-5.6M19.3 12c.7.7 1.1 1.7 1.1 2.8M16.7 6.3A6 6 0 0 1 18 10" />,
  TrendingUp: () => <Icon d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />,
  AlertCircle: () => <Icon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01" />,
};

// ─────────────────────────────────────────────
//  GLOBAL STYLES
// ─────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0f1e;
      --surface: #111827;
      --surface2: #1a2235;
      --surface3: #243050;
      --border: rgba(255,255,255,0.08);
      --border2: rgba(255,255,255,0.14);
      --text: #f0f4ff;
      --text2: #94a3b8;
      --text3: #64748b;
      --accent: #4f8ef7;
      --accent2: #6366f1;
      --green: #22c55e;
      --yellow: #f59e0b;
      --red: #ef4444;
      --glow: rgba(79,142,247,0.15);
      --font: 'DM Sans', sans-serif;
      --mono: 'Space Mono', monospace;
      --radius: 14px;
      --radius-sm: 8px;
    }

    html, body, #root { height: 100%; }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    input, button, select { font-family: var(--font); }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--surface); }
    ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 3px; }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-ring {
      0% { transform: scale(0.8); opacity: 0.8; }
      50% { transform: scale(1.1); opacity: 0.3; }
      100% { transform: scale(0.8); opacity: 0.8; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes countUp {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .fade-in { animation: fadeIn 0.4s ease both; }
    .fade-in-delay { animation: fadeIn 0.4s ease 0.15s both; }

    .spinner {
      width: 20px; height: 20px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }

    /* Grid bg pattern */
    .grid-bg {
      background-image:
        linear-gradient(rgba(79,142,247,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79,142,247,0.04) 1px, transparent 1px);
      background-size: 48px 48px;
    }

    /* Card styles */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
    }

    /* Badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
    }
    .badge-green { background: rgba(34,197,94,0.15); color: var(--green); }
    .badge-yellow { background: rgba(245,158,11,0.15); color: var(--yellow); }
    .badge-red { background: rgba(239,68,68,0.15); color: var(--red); }
    .badge-blue { background: rgba(79,142,247,0.15); color: var(--accent); }

    /* Table */
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text3);
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 13px 16px;
      font-size: 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text2);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }

    /* Button base */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      outline: none;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    .btn-primary:hover:not(:disabled) { background: #3d7de8; transform: translateY(-1px); }
    .btn-ghost {
      background: transparent;
      color: var(--text2);
      border: 1px solid var(--border2);
    }
    .btn-ghost:hover:not(:disabled) { background: var(--surface2); color: var(--text); }
    .btn-danger {
      background: rgba(239,68,68,0.15);
      color: var(--red);
      border: 1px solid rgba(239,68,68,0.3);
    }
    .btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }

    /* Input */
    .input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .input-group label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text2);
    }
    .input {
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: var(--radius-sm);
      padding: 11px 14px;
      color: var(--text);
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
      outline: none;
    }
    .input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(79,142,247,0.15);
    }
    .input::placeholder { color: var(--text3); }

    /* Toast */
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
      animation: fadeIn 0.3s ease both;
      max-width: 360px;
    }
    .toast-success { background: #16a34a; color: white; }
    .toast-error { background: #dc2626; color: white; }
    .toast-info { background: var(--accent); color: white; }

    /* Responsive */
    @media (max-width: 768px) {
      .hide-mobile { display: none !important; }
      .card { padding: 16px; }
    }
  `}</style>
);

// ─────────────────────────────────────────────
//  TOAST SYSTEM
// ─────────────────────────────────────────────
let toastId = 0;
let addToastFn = null;

const toast = {
  success: (msg) => addToastFn?.({ id: ++toastId, type: "success", msg }),
  error: (msg) => addToastFn?.({ id: ++toastId, type: "error", msg }),
  info: (msg) => addToastFn?.({ id: ++toastId, type: "info", msg }),
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastFn = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    return () => { addToastFn = null; };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === "success" && <Icons.Check />}
          {t.type === "error" && <Icons.X />}
          {t.type === "info" && <Icons.AlertCircle />}
          {t.msg}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
//  LOGIN PAGE
// ─────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "employees", cred.user.uid));
      if (!userDoc.exists()) throw new Error("User record not found.");
      onLogin({ uid: cred.user.uid, ...userDoc.data() });
      toast.success("Welcome back!");
    } catch (err) {
      toast.error(err.message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      {/* Glow blobs */}
      <div style={{ position: "fixed", top: "20%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,142,247,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "20%", right: "15%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="fade-in" style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, var(--accent), var(--accent2))", marginBottom: 20, boxShadow: "0 0 40px rgba(79,142,247,0.3)" }}>
            <Icons.Fingerprint />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>AttendTrack</h1>
          <p style={{ color: "var(--text2)", marginTop: 6, fontSize: 14 }}>Workforce Attendance Management</p>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)", marginTop: 10, opacity: 0.8 }}>
            {formatTime(now)}
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Sign In</h2>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="input-group">
              <label>Email Address</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8, padding: "13px", fontSize: 15, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), var(--accent2))", boxShadow: "0 4px 20px rgba(79,142,247,0.3)" }}>
              {loading ? <span className="spinner" /> : "Sign In →"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text3)" }}>
            Contact your admin to get access
          </p>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  EMPLOYEE DASHBOARD
// ─────────────────────────────────────────────
const EmployeeDashboard = ({ user }) => {
  const [now, setNow] = useState(new Date());
  const [window_, setWindow_] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load attendance window
      const wDoc = await getDoc(doc(db, "settings", "attendance_window"));
      if (wDoc.exists()) setWindow_(wDoc.data());

      // Load today's record
      const today = todayStr();
      const recRef = doc(db, "attendance", `${user.uid}_${today}`);
      const recDoc = await getDoc(recRef);
      if (recDoc.exists()) setTodayRecord(recDoc.data());

      // Load history (last 7 records)
      const q = query(
        collection(db, "attendance"),
        where("uid", "==", user.uid),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.slice(0, 14).map(d => d.data()));
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => { loadData(); }, [loadData]);

  const markAttendance = async () => {
    if (!window_) return toast.error("No attendance window configured");
    setMarking(true);
    try {
      const status_key = getAttendanceStatus(window_, now);
      if (status_key === "early") return toast.info("Attendance window hasn't opened yet");
      if (status_key === "closed") return toast.error("Attendance window is closed for today");

      const today = todayStr();
      const status = status_key === "on_time" ? "present" : "late";

      await setDoc(doc(db, "attendance", `${user.uid}_${today}`), {
        uid: user.uid,
        name: user.name,
        email: user.email,
        date: today,
        markedAt: now.toISOString(),
        time: formatTime(now),
        status,
        timestamp: serverTimestamp(),
      });

      setTodayRecord({ date: today, time: formatTime(now), status });
      toast.success(status === "present" ? "✓ Attendance marked — On Time!" : "⚠ Attendance marked — Late");
      loadData();
    } catch (err) {
      toast.error("Failed to mark attendance");
    } finally {
      setMarking(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const windowStatus = window_ ? getAttendanceStatus(window_, now) : null;
  const presentDays = history.filter(r => r.status === "present").length;
  const lateDays = history.filter(r => r.status === "late").length;

  return (
    <div className="grid-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "rgba(10,15,30,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icons.Fingerprint />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>AttendTrack</div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{formatTime(now)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }} className="hide-mobile">
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Employee</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
            <Icons.User />
          </div>
          <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: "8px 14px", fontSize: 13 }}>
            <Icons.LogOut /> <span className="hide-mobile">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: "32px 24px", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <div className="fade-in" style={{ display: "grid", gap: 24 }}>
          {/* Welcome + Mark Attendance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "start" }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
                Good {now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening"}, {user.name.split(" ")[0]} 👋
              </h1>
              <p style={{ color: "var(--text2)", marginTop: 4 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
          </div>

          {/* Attendance Window Info */}
          {window_ && (
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(135deg, var(--surface), var(--surface2))" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(79,142,247,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                <Icons.Clock />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 2 }}>Today's Attendance Window</div>
                <div style={{ fontWeight: 600 }}>{window_.start} — {window_.end} · On time before {window_.lateAfter}</div>
              </div>
              <div>
                {windowStatus === "early" && <span className="badge badge-blue">Opens Soon</span>}
                {windowStatus === "on_time" && <span className="badge badge-green">● Open</span>}
                {windowStatus === "late" && <span className="badge badge-yellow">● Late Window</span>}
                {windowStatus === "closed" && <span className="badge badge-red">● Closed</span>}
              </div>
            </div>
          )}

          {/* Mark Attendance CTA */}
          <div className="card fade-in-delay" style={{ textAlign: "center", padding: "48px 24px", background: "linear-gradient(135deg, var(--surface), #162035)", position: "relative", overflow: "hidden" }}>
            {/* BG accent */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,142,247,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

            {todayRecord ? (
              <div style={{ position: "relative" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: todayRecord.status === "present" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: `2px solid ${todayRecord.status === "present" ? "var(--green)" : "var(--yellow)"}` }}>
                  <Icons.Check />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Attendance Recorded</h2>
                <p style={{ color: "var(--text2)", marginBottom: 16 }}>You marked attendance at <strong style={{ color: "var(--text)" }}>{todayRecord.time}</strong></p>
                <span className={`badge ${todayRecord.status === "present" ? "badge-green" : "badge-yellow"}`} style={{ fontSize: 14, padding: "6px 16px" }}>
                  {todayRecord.status === "present" ? "✓ On Time" : "⚠ Late"}
                </span>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                {/* Pulse ring */}
                {(windowStatus === "on_time" || windowStatus === "late") && (
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -120%)", width: 100, height: 100, borderRadius: "50%", border: "2px solid var(--accent)", opacity: 0.3, animation: "pulse-ring 2s ease-in-out infinite" }} />
                )}
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(79,142,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", border: "2px solid rgba(79,142,247,0.3)" }}>
                  <Icons.Fingerprint />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Mark Your Attendance</h2>
                <p style={{ color: "var(--text2)", marginBottom: 24, maxWidth: 340, margin: "0 auto 24px" }}>
                  {windowStatus === "early" && "The attendance window hasn't opened yet. Please come back later."}
                  {windowStatus === "on_time" && "Attendance is open! Mark yourself as present now."}
                  {windowStatus === "late" && "You're past the on-time window. You can still mark — it will be recorded as Late."}
                  {windowStatus === "closed" && "Attendance window is closed for today. You will be marked Absent."}
                  {!windowStatus && "Loading attendance window..."}
                </p>
                <button
                  className="btn"
                  onClick={markAttendance}
                  disabled={marking || !windowStatus || windowStatus === "early" || windowStatus === "closed"}
                  style={{
                    padding: "14px 40px", fontSize: 16, borderRadius: 12,
                    background: windowStatus === "on_time" ? "linear-gradient(135deg, var(--accent), var(--accent2))" : windowStatus === "late" ? "linear-gradient(135deg, var(--yellow), #d97706)" : "var(--surface3)",
                    color: "white", boxShadow: windowStatus === "on_time" ? "0 4px 24px rgba(79,142,247,0.35)" : "none",
                    border: "none", cursor: (windowStatus === "early" || windowStatus === "closed") ? "not-allowed" : "pointer",
                  }}
                >
                  {marking ? <span className="spinner" /> : windowStatus === "on_time" ? "✓ Mark Present" : windowStatus === "late" ? "⚠ Mark Late" : "Unavailable"}
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "On Time", value: presentDays, icon: <Icons.Check />, color: "var(--green)", bg: "rgba(34,197,94,0.1)" },
              { label: "Late", value: lateDays, icon: <Icons.Clock />, color: "var(--yellow)", bg: "rgba(245,158,11,0.1)" },
              { label: "Records", value: history.length, icon: <Icons.Calendar />, color: "var(--accent)", bg: "rgba(79,142,247,0.1)" },
            ].map((s) => (
              <div key={s.label} className="card" style={{ textAlign: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, margin: "0 auto 12px" }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "var(--mono)" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="card">
              <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: 16 }}>Attendance History</h3>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text)", fontWeight: 500 }}>{formatDate(r.date)}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{r.time}</td>
                        <td>
                          <span className={`badge ${r.status === "present" ? "badge-green" : "badge-yellow"}`}>
                            {r.status === "present" ? "On Time" : "Late"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────
//  ADMIN DASHBOARD
// ─────────────────────────────────────────────
const AdminDashboard = ({ user }) => {
  const [tab, setTab] = useState("overview");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [filterDate, setFilterDate] = useState(todayStr());
  const [window_, setWindow_] = useState({ start: "09:00", end: "09:30", lateAfter: "09:15" });
  const [newEmp, setNewEmp] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingEmp, setAddingEmp] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empSnap, attSnap, wDoc] = await Promise.all([
        getDocs(collection(db, "employees")),
        getDocs(query(collection(db, "attendance"), where("date", "==", filterDate), orderBy("timestamp", "asc"))),
        getDoc(doc(db, "settings", "attendance_window")),
      ]);

      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.role !== "admin"));
      setAttendance(attSnap.docs.map(d => d.data()));
      if (wDoc.exists()) setWindow_(wDoc.data());
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveWindow = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "attendance_window"), window_);
      toast.success("Attendance window saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addEmployee = async (e) => {
    e.preventDefault();
    setAddingEmp(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmp.email, newEmp.password);
      await setDoc(doc(db, "employees", cred.user.uid), {
        name: newEmp.name,
        email: newEmp.email,
        role: "employee",
        createdAt: serverTimestamp(),
      });
      // Sign admin back in (creating user logs them in automatically)
      setNewEmp({ name: "", email: "", password: "" });
      toast.success(`Employee ${newEmp.name} added!`);
      loadData();
    } catch (err) {
      toast.error(err.message.replace("Firebase: ", ""));
    } finally {
      setAddingEmp(false);
    }
  };

  const exportCSV = () => {
    const rows = [["Name", "Email", "Date", "Time", "Status"]];
    const empMap = {};
    employees.forEach(e => { empMap[e.id] = e; });

    attendance.forEach(r => rows.push([r.name, r.email, r.date, r.time, r.status]));

    // Add absent
    employees.forEach(emp => {
      if (!attendance.find(a => a.uid === emp.id)) {
        rows.push([emp.name, emp.email, filterDate, "-", "absent"]);
      }
    });

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance_${filterDate}.csv`; a.click();
    toast.success("CSV exported!");
  };

  const presentCount = attendance.filter(r => r.status === "present").length;
  const lateCount = attendance.filter(r => r.status === "late").length;
  const absentCount = employees.length - attendance.length;

  const tabs = [
    { id: "overview", label: "Overview", icon: <Icons.TrendingUp /> },
    { id: "attendance", label: "Attendance", icon: <Icons.Calendar /> },
    { id: "employees", label: "Employees", icon: <Icons.Users /> },
    { id: "settings", label: "Settings", icon: <Icons.Settings /> },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "rgba(10,15,30,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icons.Fingerprint />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>AttendTrack <span style={{ fontSize: 11, background: "rgba(99,102,241,0.2)", color: "var(--accent2)", padding: "2px 7px", borderRadius: 5, marginLeft: 6, fontWeight: 600 }}>ADMIN</span></div>
            <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "var(--mono)" }}>{formatTime(now)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="hide-mobile" style={{ fontSize: 13, color: "var(--text2)", marginRight: 8 }}>{user.name}</div>
          <button className="btn btn-ghost" onClick={() => signOut(auth)} style={{ padding: "8px 14px", fontSize: 13 }}>
            <Icons.LogOut /> <span className="hide-mobile">Sign Out</span>
          </button>
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <aside style={{ width: 220, borderRight: "1px solid var(--border)", padding: "24px 16px", background: "var(--surface)", flexShrink: 0 }} className="hide-mobile">
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font)", fontSize: 14, fontWeight: 500, textAlign: "left", background: tab === t.id ? "rgba(79,142,247,0.12)" : "transparent", color: tab === t.id ? "var(--accent)" : "var(--text2)", transition: "all 0.15s" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tab bar */}
        <div style={{ display: "none" }} className="show-mobile" />

        {/* Content */}
        <main style={{ flex: 1, padding: "28px 24px", overflowY: "auto" }} className="grid-bg">
          <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>

            {/* Mobile tab bar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} className="btn" style={{ fontSize: 12, padding: "7px 14px", background: tab === t.id ? "var(--accent)" : "var(--surface)", color: tab === t.id ? "white" : "var(--text2)", border: "1px solid var(--border)", borderRadius: 8, flexShrink: 0 }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {tab === "overview" && (
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Dashboard Overview</h1>
                  <p style={{ color: "var(--text2)", marginTop: 4, fontSize: 14 }}>{formatDate(filterDate)}</p>
                </div>

                {/* Date picker */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input className="input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: "auto" }} />
                  <button className="btn btn-ghost" onClick={loadData}>{loading ? <span className="spinner" /> : "Refresh"}</button>
                  <button className="btn btn-ghost" onClick={exportCSV}><Icons.Download /> Export CSV</button>
                </div>

                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  {[
                    { label: "Total Employees", value: employees.length, color: "var(--accent)", bg: "rgba(79,142,247,0.08)", icon: <Icons.Users /> },
                    { label: "Present", value: presentCount, color: "var(--green)", bg: "rgba(34,197,94,0.08)", icon: <Icons.Check /> },
                    { label: "Late", value: lateCount, color: "var(--yellow)", bg: "rgba(245,158,11,0.08)", icon: <Icons.Clock /> },
                    { label: "Absent", value: Math.max(0, absentCount), color: "var(--red)", bg: "rgba(239,68,68,0.08)", icon: <Icons.X /> },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ background: s.bg, borderColor: "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 36, fontWeight: 700, color: s.color, fontFamily: "var(--mono)", lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 6 }}>{s.label}</div>
                        </div>
                        <div style={{ color: s.color, opacity: 0.6 }}>{s.icon}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Attendance rate bar */}
                {employees.length > 0 && (
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>Attendance Rate</span>
                      <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{Math.round((attendance.length / employees.length) * 100)}%</span>
                    </div>
                    <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, var(--green), var(--accent))", width: `${Math.round((attendance.length / employees.length) * 100)}%`, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}><span style={{ color: "var(--green)" }}>■</span> Present ({presentCount})</span>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}><span style={{ color: "var(--yellow)" }}>■</span> Late ({lateCount})</span>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}><span style={{ color: "var(--red)" }}>■</span> Absent ({Math.max(0, absentCount)})</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ATTENDANCE TAB */}
            {tab === "attendance" && (
              <div style={{ display: "grid", gap: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>Attendance Records</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: "auto" }} />
                    <button className="btn btn-ghost" onClick={exportCSV}><Icons.Download /> CSV</button>
                  </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Time Marked</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map(emp => {
                          const rec = attendance.find(a => a.uid === emp.id);
                          return (
                            <tr key={emp.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>{emp.name}</div>
                                <div style={{ fontSize: 12, color: "var(--text3)" }}>{emp.email}</div>
                              </td>
                              <td style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{rec ? rec.time : "—"}</td>
                              <td>
                                {rec ? (
                                  <span className={`badge ${rec.status === "present" ? "badge-green" : "badge-yellow"}`}>
                                    {rec.status === "present" ? "✓ On Time" : "⚠ Late"}
                                  </span>
                                ) : (
                                  <span className="badge badge-red">✗ Absent</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {employees.length === 0 && (
                          <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No employees found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* EMPLOYEES TAB */}
            {tab === "employees" && (
              <div style={{ display: "grid", gap: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Manage Employees</h2>

                {/* Add employee form */}
                <div className="card">
                  <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Add New Employee</h3>
                  <form onSubmit={addEmployee} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                    <div className="input-group">
                      <label>Full Name</label>
                      <input className="input" value={newEmp.name} onChange={e => setNewEmp(p => ({ ...p, name: e.target.value }))} placeholder="Jane Doe" required />
                    </div>
                    <div className="input-group">
                      <label>Email</label>
                      <input className="input" type="email" value={newEmp.email} onChange={e => setNewEmp(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" required />
                    </div>
                    <div className="input-group">
                      <label>Password</label>
                      <input className="input" type="password" value={newEmp.password} onChange={e => setNewEmp(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" required minLength={6} />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={addingEmp} style={{ height: 44 }}>
                      {addingEmp ? <span className="spinner" /> : <><Icons.Plus /> Add</>}
                    </button>
                  </form>
                </div>

                {/* Employee list */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600 }}>All Employees ({employees.length})</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map(emp => (
                        <tr key={emp.id}>
                          <td style={{ fontWeight: 600, color: "var(--text)" }}>{emp.name}</td>
                          <td>{emp.email}</td>
                          <td><span className="badge badge-blue">Employee</span></td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No employees added yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {tab === "settings" && (
              <div style={{ display: "grid", gap: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Attendance Settings</h2>

                <div className="card" style={{ maxWidth: 520 }}>
                  <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Attendance Time Window</h3>
                  <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>Set when employees can mark attendance each day</p>

                  <div style={{ display: "grid", gap: 16 }}>
                    <div className="input-group">
                      <label>Window Opens At</label>
                      <input className="input" type="time" value={window_.start} onChange={e => setWindow_(p => ({ ...p, start: e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label>Marked "Late" After</label>
                      <input className="input" type="time" value={window_.lateAfter} onChange={e => setWindow_(p => ({ ...p, lateAfter: e.target.value }))} />
                    </div>
                    <div className="input-group">
                      <label>Window Closes At</label>
                      <input className="input" type="time" value={window_.end} onChange={e => setWindow_(p => ({ ...p, end: e.target.value }))} />
                    </div>

                    <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "var(--text2)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Icons.AlertCircle />
                      <div>
                        Employees marking between <strong style={{ color: "var(--text)" }}>{window_.start}–{window_.lateAfter}</strong> are <strong style={{ color: "var(--green)" }}>On Time</strong>.
                        Between <strong style={{ color: "var(--text)" }}>{window_.lateAfter}–{window_.end}</strong> are marked <strong style={{ color: "var(--yellow)" }}>Late</strong>.
                      </div>
                    </div>

                    <button className="btn btn-primary" onClick={saveWindow} disabled={saving} style={{ width: "fit-content" }}>
                      {saving ? <span className="spinner" /> : "Save Settings"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, "employees", user.uid));
        if (docSnap.exists()) {
          setUserData({ uid: user.uid, ...docSnap.data() });
          setAuthUser(user);
        }
      } else {
        setAuthUser(null);
        setUserData(null);
      }
      setAuthLoading(false);
    });
  }, []);

  if (authLoading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px", borderWidth: 3 }} />
          <div style={{ color: "var(--text3)", fontSize: 14 }}>Loading AttendTrack…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <GlobalStyle />
      <ToastContainer />
      {!authUser ? (
        <LoginPage onLogin={(u) => setUserData(u)} />
      ) : userData?.role === "admin" ? (
        <AdminDashboard user={userData} />
      ) : (
        <EmployeeDashboard user={userData} />
      )}
    </>
  );
}
