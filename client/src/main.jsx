import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { buildWebPreview, formatPredictedTerminal } from "./code-runner.js";
import "./runner.css";
import {
  BrowserRouter,
  useLocation,
  useNavigate,
  useParams,
  Link,
  NavLink,
  Outlet,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Code2,
  UserCircle,
  Settings,
  LogOut,
  Menu,
  Flame,
  Star,
  CheckCircle2,
  ArrowRight,
  Bookmark,
  Play,
  Search,
  Sun,
  Moon,
  Sparkles,
  ChevronRight,
  Lock,
  Trophy,
  Bot,
  Mic,
  MicOff,
  Send,
  AlertTriangle,
  Eye,
  EyeOff,
  Volume2,
  StopCircle,
  StickyNote,
  Brain,
  FileText,
  ClipboardList,
  TerminalSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Copy,
  WandSparkles,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  RotateCcw,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";
import "./styles.css";
import "./tutor.css";

const API = "/api";
async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.details || d.error || `Request failed (${r.status})`);
    e.status = r.status;
    throw e;
  }
  return d;
}

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
function applyTheme(theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;
  document.documentElement.dataset.theme = resolved;
}
function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/auth/me")
      .then((x) => setUser(x.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user?.theme) applyTheme(user.theme);
  }, [user?.theme]);
  const value = useMemo(() => ({ user, setUser, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route element={<Protected />}>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="learn" element={<Learn />} />
            <Route path="learn/:slug" element={<Course />} />
            <Route path="lesson/:slug" element={<Lesson />} />
            <Route path="practice" element={<Practice />} />
            <Route path="projects" element={<Projects />} />
            <Route path="tutor" element={<TutorChat />} />
            <Route path="notes" element={<Notes />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function Splash() {
  return (
    <div className="splash">
      <div className="logoMark">L</div>
      <h1>Learny</h1>
      <div className="loader" />
    </div>
  );
}
function AuthCard({ title, subtitle, children }) {
  return (
    <div className="authPage">
      <div className="authGlow glowA" />
      <div className="authGlow glowB" />
      <div className="authCard">
        <div className="brand">
          <span className="logoMark">L</span>
          <span>Learny</span>
        </div>
        <div className="eyebrow">
          <Sparkles size={15} /> Learn. Practice. Build.
        </div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete = "off",
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}
function AuthPage({ mode }) {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState(
    mode === "login"
      ? { identifier: "", password: "" }
      : { username: "", email: "", displayName: "", password: "" },
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = await api(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (d.requiresVerification) {
        setNotice(
          "Your account is ready! We sent a verification email with a secure button. Please check your inbox and spam folder.",
        );
      } else {
        setUser(d.user);
        nav("/");
      }
    } catch (e) {
      setError(e.message);
      setCanResend(
        e.status === 403 && mode === "login" && form.identifier.includes("@"),
      );
      if (e.status === 403 && mode === "login")
        setNotice(
          "Your email may not be verified yet. You can resend the verification email below.",
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard
      title={mode === "login" ? "Welcome back" : "Create your Learny account"}
      subtitle={
        mode === "login"
          ? "Continue where you left off."
          : "Learn, practice, take tests, make notes and build with AI."
      }
    >
      <form onSubmit={submit} className="form">
        {mode === "register" && (
          <>
            <Field
              label="Display name"
              value={form.displayName}
              onChange={(v) => setForm({ ...form, displayName: v })}
              placeholder="Your name"
              autoComplete="name"
            />
            <Field
              label="Username"
              value={form.username}
              onChange={(v) => setForm({ ...form, username: v.toLowerCase() })}
              placeholder="coder_01"
              autoComplete="username"
            />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
            />{" "}
          </>
        )}
        {mode === "login" && (
          <Field
            label="Username or email"
            value={form.identifier}
            onChange={(v) => setForm({ ...form, identifier: v })}
            placeholder="username or email"
            autoComplete="username"
          />
        )}
        <Field
          label="Password"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
          placeholder="At least 8 characters"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "login" && (
          <div className="alignRight">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {canResend && (
          <button
            type="button"
            className="secondary wide"
            onClick={async () => {
              try {
                await api("/auth/resend-verification", {
                  method: "POST",
                  body: JSON.stringify({ email: form.identifier }),
                });
                setNotice(
                  "A fresh verification email is on its way. Please check your inbox and spam folder.",
                );
                setError("");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Resend verification email
          </button>
        )}
        {notice && <div className="success wrap">{notice}</div>}
        <button className="primary wide" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}{" "}
          <ArrowRight size={17} />
        </button>
      </form>
      <div className="authDivider">
        <span>or</span>
      </div>
      <a className="secondary wide center" href="/api/auth/google">
        Continue with Google
      </a>
      <div className="authSwitch">
        {mode === "login" ? (
          <>
            New here? <Link to="/register">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link to="/login">Sign in</Link>
          </>
        )}
      </div>
    </AuthCard>
  );
}
function ForgotPassword() {
  const [email, setEmail] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice(
        d.devResetUrl
          ? `Development reset link: ${d.devResetUrl}`
          : "If the account exists, reset instructions were sent.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We will send a secure one-time reset link."
    >
      <form onSubmit={submit} className="form">
        <Field
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
        />
        {error && <div className="error">{error}</div>}
        {notice && <div className="success wrap">{notice}</div>}
        <button className="primary wide" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"} <ArrowRight size={17} />
        </button>
      </form>
      <div className="authSwitch">
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}
function ResetPassword() {
  const token = new URLSearchParams(useLocation().search).get("token") || "";
  const nav = useNavigate();
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      nav("/");
      window.location.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Use a strong password you do not reuse elsewhere."
    >
      <form onSubmit={submit} className="form">
        <Field
          label="New password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          type="password"
          autoComplete="new-password"
        />
        {error && <div className="error">{error}</div>}
        <button className="primary wide" disabled={!token || busy}>
          {busy ? "Updating…" : "Update password"} <ArrowRight size={17} />
        </button>
      </form>
    </AuthCard>
  );
}
function VerifyEmail() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const token = new URLSearchParams(useLocation().search).get("token") || "";
  const [state, setState] = useState(
    token ? "Verifying your email…" : "Missing verification token",
  );
  useEffect(() => {
    if (!token) return;
    api("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((d) => {
        setUser(d.user);
        nav("/");
      })
      .catch((e) => setState(e.message));
  }, [token]);
  return (
    <AuthCard title="Verify your email" subtitle={state}>
      <div className="authSwitch">
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  );
}

function Shell() {
  const { user, setUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const items = [
    ["/", "Dashboard", LayoutDashboard],
    ["/learn", "Learn", BookOpen],
    ["/practice", "Practice", Code2],
    ["/projects", "Projects", FolderKanban],
    ["/tutor", "AI Tutor", Bot],
    ["/notes", "Notes", StickyNote],
    ["/profile", "Profile", UserCircle],
    ["/settings", "Settings", Settings],
  ];
  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
    nav("/login");
  };
  return (
    <div className="app">
      <aside
        className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobileOpen" : ""}`}
      >
        <div className="brand">
          <span className="logoMark">L</span>
          <span className="brandText">Learny</span>
        </div>
        <div className="sideLabel">Workspace</div>
        <nav>
          {items.map(([p, t, I]) => (
            <NavLink
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `navItem ${isActive ? "active" : ""}`
              }
              to={p}
              key={p}
            >
              <I size={19} />
              <span>{t}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sideBottom">
          <div className="miniCard">
            <div className="miniIcon">
              <Trophy size={18} />
            </div>
            <div>
              <b>Keep going!</b>
              <small>{user?.xp || 0} XP earned</small>
            </div>
          </div>
          <button className="navItem logout" onClick={logout}>
            <LogOut size={19} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobileBackdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="main">
        <header>
          <button
            className="iconBtn menuTrigger"
            aria-label="Toggle navigation"
            onClick={() => {
              if (window.innerWidth <= 900) setMobileOpen((v) => !v);
              else setCollapsed((v) => !v);
            }}
          >
            {collapsed ? <PanelLeftOpen /> : <Menu />}
          </button>
          <div className="headerTitle">{titleFor(loc.pathname)}</div>
          <div className="headerActions">
            <div className="xpPill">
              <Star size={15} fill="currentColor" /> {user?.xp || 0} XP
            </div>
            <Link className="avatar" to="/profile">
              {(user?.displayName || "U")[0].toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
function titleFor(p) {
  if (p === "/") return "Dashboard";
  if (p.startsWith("/learn")) return "Learn";
  if (p.startsWith("/practice")) return "Practice Lab";
  if (p.startsWith("/projects")) return "Projects";
  if (p.startsWith("/tutor")) return "AI Tutor";
  if (p.startsWith("/notes")) return "My Notes";
  if (p.startsWith("/profile")) return "Profile";
  if (p.startsWith("/settings")) return "Settings";
  return "Learny";
}

function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    api("/dashboard").then(setD);
  }, []);
  if (!d) return <PageLoading />;
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} /> Your learning cockpit
          </div>
          <h1>Hey {user.displayName.split(" ")[0]}, ready to build?</h1>
          <p>
            Learn concepts, practice them, ask AI, make notes and test yourself.
          </p>
          <div className="heroBtns">
            <Link
              className="primary"
              to={d.next ? `/lesson/${d.next.slug}` : "/learn"}
            >
              <Play size={16} fill="currentColor" /> Continue learning
            </Link>
            <Link className="secondary" to="/tutor">
              <Bot size={16} /> Ask AI Tutor
            </Link>
          </div>
        </div>
        <div className="heroOrb">
          <div className="orbCore">
            <span>{d.stats.progress}%</span>
            <small>complete</small>
          </div>
        </div>
      </section>
      <div className="statsGrid">
        <Stat
          icon={<CheckCircle2 />}
          label="Lessons done"
          value={`${d.stats.completedLessons}/${d.stats.totalLessons}`}
        />
        <Stat icon={<Flame />} label="Day streak" value={user.streak || 0} />
        <Stat icon={<Star />} label="XP" value={user.xp} />
        <Stat
          icon={<Trophy />}
          label="Level"
          value={Math.floor(user.xp / 100) + 1}
        />
      </div>
      <section className="sectionHead">
        <div>
          <h2>Study shortcuts</h2>
          <p className="muted">
            Use AI for the boring parts, then focus on understanding.
          </p>
        </div>
      </section>
      <div className="quickGrid">
        <Quick
          to="/tutor"
          icon={<Brain />}
          title="Explain a topic"
          text="Get a simple explanation with examples."
        />
        <Quick
          to="/notes"
          icon={<StickyNote />}
          title="Make notes"
          text="Turn a topic into structured study notes."
        />
        <Quick
          to="/tutor"
          icon={<ClipboardList />}
          title="Take a test"
          text="Generate a 5-question quiz on any topic."
        />
        <Quick
          to="/practice"
          icon={<Code2 />}
          title="Build code"
          text="Practice safely in the browser editor."
        />
      </div>
      <section className="sectionHead">
        <div>
          <h2>Pick up a course</h2>
          <p className="muted">Focused tracks, not endless content.</p>
        </div>
        <Link to="/learn">
          View all <ChevronRight size={16} />
        </Link>
      </section>
      <div className="courseGrid">
        {d.courses.slice(0, 6).map((c) => (
          <CourseCard key={c.id} c={c} />
        ))}
      </div>
    </>
  );
}
function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <div className="statIcon">{icon}</div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function Quick({ to, icon, title, text }) {
  return (
    <Link className="quickCard" to={to}>
      <div className="quickIcon">{icon}</div>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
      <ArrowRight size={17} />
    </Link>
  );
}
function CourseCard({ c }) {
  const pct = c.lessons
    ? Math.round(((c.completed || 0) / c.lessons) * 100)
    : 0;
  return (
    <Link
      to={`/learn/${c.slug}`}
      className="courseCard"
      style={{ "--accent": c.accent }}
    >
      <div className="courseTop">
        <span className="courseIcon">{c.icon}</span>
        <span className="level">{c.level}</span>
      </div>
      <h3>{c.title}</h3>
      <p>{c.description}</p>
      <div className="progressLine">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="courseFoot">
        <small>
          {c.completed || 0}/{c.lessons} lessons
        </small>
        <span>{pct}%</span>
      </div>
    </Link>
  );
}
function Learn() {
  const [courses, setCourses] = useState([]),
    [q, setQ] = useState("");
  useEffect(() => {
    api("/courses").then((x) => setCourses(x.courses));
  }, []);
  const filtered = courses.filter((c) =>
    (c.title + " " + c.description).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <section className="pageIntro">
        <div>
          <div className="eyebrow">
            <BookOpen size={15} /> Learning paths
          </div>
          <h1>Learn by building your foundation</h1>
          <p className="muted">Finish lessons, then practice the idea.</p>
        </div>
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Search courses…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </section>
      <div className="courseGrid large">
        {filtered.map((c) => (
          <CourseCard key={c.id} c={c} />
        ))}
      </div>
    </>
  );
}
function Course() {
  const { slug } = useParams();
  const [d, setD] = useState(null),
    [level, setLevel] = useState("All");
  useEffect(() => {
    api(`/courses/${slug}`).then(setD);
  }, [slug]);
  if (!d) return <PageLoading />;
  const levels = ["All", "Beginner", "Moderate", "Advanced"];
  const lessons =
    level === "All" ? d.lessons : d.lessons.filter((l) => l.level === level);
  return (
    <>
      <Link className="back" to="/learn">
        ← All courses
      </Link>
      <section className="courseHero">
        <div className="courseBigIcon" style={{ background: d.course.accent }}>
          {d.course.icon}
        </div>
        <div>
          <div className="eyebrow">
            {d.course.level} • {d.lessons.length} lessons
          </div>
          <h1>{d.course.title}</h1>
          <p>{d.course.description}</p>
        </div>
      </section>
      <div className="levelTabs">
        {levels.map((x) => (
          <button
            key={x}
            className={level === x ? "selected" : ""}
            onClick={() => setLevel(x)}
          >
            {x}
            <small>
              {x === "All"
                ? d.lessons.length
                : d.lessons.filter((l) => l.level === x).length}
            </small>
          </button>
        ))}
      </div>
      <div className="lessonList">
        {lessons.map((l, i) => (
          <Link className="lessonRow" to={`/lesson/${l.slug}`} key={l.id}>
            <div className="lessonNum">
              {l.completed ? (
                <CheckCircle2 size={20} />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </div>
            <div className="lessonInfo">
              <div className="lessonMeta">
                <span className={`difficulty ${l.level?.toLowerCase()}`}>
                  {l.level || "Beginner"}
                </span>
                <small>+{l.xp} XP</small>
              </div>
              <h3>{l.title}</h3>
              <p>{l.summary}</p>
            </div>
            <div className="lessonEnd">
              {l.bookmarked && <Bookmark size={17} fill="currentColor" />}
              <ChevronRight />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
function Lesson() {
  const { slug } = useParams();
  const [d, setD] = useState(null),
    [projects, setProjects] = useState([]),
    [msg, setMsg] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    Promise.all([
      api(`/lessons/${slug}`),
      api(`/lessons/${slug}/projects`),
    ]).then(([lessonData, projectData]) => {
      setD(lessonData);
      setProjects(projectData.projects);
    });
  }, [slug]);
  if (!d) return <PageLoading />;
  const l = d.lesson;
  const complete = async () => {
    await api(`/lessons/${l.id}/progress`, { method: "POST" });
    setD({ ...d, lesson: { ...l, completed: 1 } });
    setMsg("Lesson complete! XP added.");
  };
  const bookmark = async () => {
    const x = await api(`/lessons/${l.id}/bookmark`, { method: "POST" });
    setD({ ...d, lesson: { ...l, bookmarked: x.bookmarked ? 1 : 0 } });
  };
  return (
    <>
      <div className="lessonHeader">
        <div>
          <Link className="back" to={`/learn/${l.courseSlug}`}>
            ← {l.courseTitle}
          </Link>
          <div className="eyebrow">
            <span className={`difficulty ${l.level?.toLowerCase()}`}>
              {l.level || "Beginner"}
            </span>{" "}
            Lesson
          </div>
          <h1>{l.title}</h1>
          <p>{l.summary}</p>
        </div>
        <button
          className={l.bookmarked ? "iconBtn saved" : "iconBtn"}
          onClick={bookmark}
        >
          <Bookmark size={20} fill={l.bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="lessonLayout">
        <article className="lessonContent">
          <div className="lessonText">
            <p>{l.content}</p>
            {l.objectives && (
              <div className="lessonBlock">
                <h3>What you will learn</h3>
                <p>{l.objectives}</p>
              </div>
            )}
            {l.example && (
              <div className="lessonBlock exampleBlock">
                <h3>Worked example</h3>
                <pre>{l.example}</pre>
              </div>
            )}
            <LessonPractice lesson={l} />
            <section className="lessonProjects">
              <div className="lessonProjectsHead">
                <div>
                  <div className="eyebrow">
                    <FolderKanban size={15} /> Learn by building
                  </div>
                  <h2>20 example projects</h2>
                  <p className="muted">
                    Work from quick wins to capstones. Each project includes a
                    brief, edge-case requirements, and a testing checklist.
                  </p>
                </div>
                <span className="projectCount">{projects.length}/20</span>
              </div>
              <div className="projectGrid">
                {projects.map((project) => (
                  <article className="projectCard" key={project.id}>
                    <div className="projectCardTop">
                      <span className="projectNumber">
                        {String(project.orderNo).padStart(2, "0")}
                      </span>
                      <span className="difficulty">{project.difficulty}</span>
                    </div>
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                    <small>
                      <b>Build checklist:</b> {project.requirements}
                    </small>
                  </article>
                ))}
              </div>
            </section>
            <div className="tip">
              <Sparkles size={18} />
              <div>
                <b>Study smarter</b>
                <p>
                  Ask AI Tutor to explain this topic, summarize it, create notes
                  or make a test.
                </p>
              </div>
            </div>
          </div>
          <div className="lessonActions">
            {msg && <span className="success">{msg}</span>}
            <button className="primary" onClick={complete}>
              {l.completed ? "Completed ✓" : "Mark lesson complete"}{" "}
              <CheckCircle2 size={17} />
            </button>
            <button className="secondary" onClick={() => nav("/practice")}>
              <Code2 size={17} /> Open Practice Lab
            </button>
            <button className="secondary" onClick={() => nav("/tutor")}>
              <Bot size={17} /> Ask AI about this lesson
            </button>
          </div>
        </article>
        <aside className="lessonSide">
          <div className="sideBox">
            <small>XP</small>
            <strong>+{l.xp}</strong>
            <p>Finish the lesson to earn XP.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
function LessonPractice({ lesson }) {
  const [answer, setAnswer] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const check = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      const d = await api("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          provider: "gemini",
          mode: "text",
          action: "review",
          message: `Check my practice answer for "${lesson.title}". Practice task: ${lesson.practicePrompt || "Explain the concept with your own example."}\n\nMy answer:\n${answer}`,
          context: {
            page: "lesson-practice",
            lesson: lesson.title,
            language: lesson.courseTitle,
          },
        }),
      });
      setFeedback(d.answer);
    } catch (e) {
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inlinePractice">
      <div className="inlinePracticeHead">
        <div>
          <h3>Practice it now</h3>
          <p>
            {lesson.practicePrompt ||
              "Explain the concept in your own words and include a small example."}
          </p>
        </div>
        <Code2 size={22} />
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer or code here…"
        rows={4}
      />
      <div className="inlinePracticeFoot">
        <button
          className="primary"
          onClick={check}
          disabled={busy || !answer.trim()}
        >
          {busy ? "Checking…" : "Check with AI"} <Sparkles size={16} />
        </button>
        {feedback && (
          <span className="muted">
            Feedback is based only on this lesson and your answer.
          </span>
        )}
      </div>
      {feedback && <div className="practiceFeedback">{feedback}</div>}
    </div>
  );
}

const EXTENSIONS = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "javascript",
  tsx: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
};
const SERVER_LANGUAGES = new Set([
  "python",
  "ruby",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "javascript",
]);
const extensionOf = (name) =>
  String(name || "")
    .toLowerCase()
    .split(".")
    .pop();
const languageOf = (name) => EXTENSIONS[extensionOf(name)] || "text";
const validPath = (value) => {
  const p = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return p &&
    !p.split("/").some((part) => !part || part === "." || part === "..")
    ? p
    : null;
};
const safeLoad = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value || fallback;
  } catch {
    return fallback;
  }
};
function WorkspaceTree({
  files,
  folders,
  activePath,
  onSelect,
  onAddFile,
  onAddFolder,
  onRename,
  onDelete,
}) {
  return (
    <div className="workspaceTree">
      <div className="treeActions">
        <button className="iconBtn" onClick={onAddFile} title="New file">
          <Plus size={15} />
        </button>
        <button className="iconBtn" onClick={onAddFolder} title="New folder">
          <FolderKanban size={15} />
        </button>
      </div>
      {folders.map((folder) => (
        <div className="treeRow folderRow" key={`folder:${folder}`}>
          <FolderKanban size={15} />
          <span>{folder}</span>
          <button onClick={() => onRename(folder, true)} title="Rename folder">
            …
          </button>
          <button onClick={() => onDelete(folder, true)} title="Delete folder">
            ×
          </button>
        </div>
      ))}
      {files.map((file) => (
        <div
          className={
            file.path === activePath
              ? "treeRow fileRow active"
              : "treeRow fileRow"
          }
          key={file.path}
        >
          <button onClick={() => onSelect(file.path)}>
            <FileText size={15} />
            <span>{file.path}</span>
          </button>
          <button
            onClick={() => onRename(file.path, false)}
            title="Rename file"
          >
            …
          </button>
          <button
            onClick={() => onDelete(file.path, false)}
            title="Delete file"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
function WorkspaceDialog({ title, value, onChange, onCancel, onSubmit }) {
  return (
    <div className="workspaceDialogBackdrop" role="presentation">
      <form
        className="workspaceDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-dialog-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <h2 id="workspace-dialog-title">{title}</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Path"
        />
        <div className="workspaceDialogActions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
function WorkspaceEditor({
  title,
  description,
  storageKey,
  initialFiles = [],
  showChallenges = false,
  questionMode = false,
}) {
  const [workspace, setWorkspace] = useState(() =>
    safeLoad(storageKey, { files: initialFiles, folders: [] }),
  );
  const [activePath, setActivePath] = useState(
    () => workspace.files?.[0]?.path || workspace.files?.[0]?.name,
  );
  const [output, setOutput] = useState("");
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("Ready");
  const [showPreview, setShowPreview] = useState(true);
  const [stdin, setStdin] = useState("");
  const [busy, setBusy] = useState(false);
  const [controller, setController] = useState(null);
  const [isAiEstimate, setIsAiEstimate] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [challenge, setChallenge] = useState(null);
  const [challengeQuery, setChallengeQuery] = useState("");
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const previewFrameRef = useRef(null);
  useEffect(
    () => localStorage.setItem(storageKey, JSON.stringify(workspace)),
    [workspace, storageKey],
  );
  useEffect(() => {
    const handlePreviewMessage = (event) => {
      if (
        event.source !== previewFrameRef.current?.contentWindow ||
        event.data?.type !== "learny-preview-console" ||
        typeof event.data.message !== "string" ||
        !["log", "info", "warn", "error"].includes(event.data.level)
      ) {
        return;
      }
      setOutput((current) =>
        `${current}${current ? "\n" : ""}${event.data.message}`.slice(-20_000),
      );
      if (event.data.level === "error") setStatus("Runtime error");
    };
    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, []);
  useEffect(() => {
    if (showChallenges)
      api("/practice")
        .then((d) => setChallenges(d.challenges || []))
        .catch(() => setStatus("Practice challenges are unavailable."));
  }, [showChallenges]);
  const files = workspace.files || [];
  const active = files.find((f) => f.path === activePath) || files[0];
  const activeLanguage = active ? languageOf(active.path) : "";
  const hasWebActive = ["html", "css", "javascript"].includes(activeLanguage);
  const filteredChallenges = challenges.filter((item) =>
    `${item.title} ${item.description} ${item.courseTitle} ${item.difficulty}`
      .toLowerCase()
      .includes(challengeQuery.toLowerCase()),
  );
  const tutorCode = files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n");
  const update = (content) =>
    active &&
    setWorkspace((w) => ({
      ...w,
      files: w.files.map((f) =>
        f.path === active.path ? { ...f, content } : f,
      ),
    }));
  const selectFile = (path) => {
    setActivePath(path);
    setShowPreview(
      ["html", "css", "javascript"].includes(languageOf(path)),
    );
  };
  const submitDialog = (value) => {
    const { mode, old, isFolder } = dialog || {};
    const next = validPath(value);
    setDialog(null);
    if (!next) return;
    if (mode === "create-file") {
      if (files.some((f) => f.path === next)) {
        setStatus("That file already exists.");
        return;
      }
      setWorkspace((w) => ({
        ...w,
        files: [...w.files, { path: next, content: "" }],
      }));
      setActivePath(next);
      setStatus(`Created ${next}`);
    } else if (mode === "create-folder") {
      if ((workspace.folders || []).includes(next)) {
        setStatus("That folder already exists.");
        return;
      }
      setWorkspace((w) => ({ ...w, folders: [...(w.folders || []), next] }));
      setStatus(`Created ${next}`);
    } else if (next !== old) {
      if (isFolder) {
        if (
          (workspace.folders || []).some(
            (x) => x === next || x.startsWith(`${next}/`),
          )
        ) {
          setStatus("A folder with that name already exists.");
          return;
        }
        setWorkspace((w) => ({
          ...w,
          folders: w.folders.map((x) =>
            x === old || x.startsWith(`${old}/`)
              ? next + x.slice(old.length)
              : x,
          ),
          files: w.files.map((f) =>
            f.path.startsWith(`${old}/`)
              ? { ...f, path: next + f.path.slice(old.length) }
              : f,
          ),
        }));
        if (activePath?.startsWith(`${old}/`))
          setActivePath(next + activePath.slice(old.length));
      } else {
        if (files.some((f) => f.path === next)) {
          setStatus("A file with that name already exists.");
          return;
        }
        setWorkspace((w) => ({
          ...w,
          files: w.files.map((f) =>
            f.path === old ? { ...f, path: next } : f,
          ),
        }));
        if (activePath === old) setActivePath(next);
      }
    }
  };
  const addFile = () =>
    setDialog({ mode: "create-file", value: "untitled.txt" });
  const addFolder = () => setDialog({ mode: "create-folder", value: "src" });
  const rename = (old, isFolder) =>
    setDialog({ mode: "rename", old, isFolder, value: old });
  const remove = (path, isFolder) => {
    if (
      !confirm(
        `Delete ${isFolder ? "folder and its files" : "file"} "${path}"?`,
      )
    )
      return;
    if (isFolder) {
      const keep = files.filter((f) => !f.path.startsWith(`${path}/`));
      setWorkspace((w) => ({
        ...w,
        folders: w.folders.filter(
          (x) => x !== path && !x.startsWith(`${path}/`),
        ),
        files: keep,
      }));
      if (activePath && !keep.some((f) => f.path === activePath))
        setActivePath(keep[0]?.path);
    } else {
      const keep = files.filter((f) => f.path !== path);
      if (!keep.length) {
        setStatus("Keep at least one file in the workspace.");
        return;
      }
      setWorkspace((w) => ({ ...w, files: keep }));
      if (activePath === path) setActivePath(keep[0].path);
    }
  };
  const run = async () => {
    if (busy || !active) return;
    setBusy(true);
    setOutput("");
    setIsAiEstimate(false);
    const language = activeLanguage;
    if (["html", "css", "javascript"].includes(language)) {
      setStatus("Starting sandboxed browser preview…");
      setPreview(buildWebPreview(files));
      setShowPreview(true);
      setBusy(false);
      return;
    }
    setStatus("AI is checking code before run…");
    const code = files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n");
    try {
      const gate = await api("/practice/preflight", {
        method: "POST",
        body: JSON.stringify({
          code,
          language,
          question: challenge?.description,
        }),
      });
      if (!gate.safe || gate.hasMistake) {
        setOutput(gate.feedback || "AI found an issue. Fix it before running.");
        setShowPreview(false);
        setStatus("Blocked by AI review");
        setBusy(false);
        return;
      }
      setOutput(`AI preflight passed: ${gate.feedback || "No blocking issues found."}`);
    } catch (e) {
      setOutput(e.message || "AI preflight failed. Code was not run.");
      setShowPreview(false);
      setStatus("Preflight failed");
      setBusy(false);
      return;
    }
    setStatus("Running…");
    if (!SERVER_LANGUAGES.has(language)) {
      setOutput(
        `Cannot run .${extensionOf(active.path) || "unknown"} files safely. This extension is not supported.`,
      );
      setShowPreview(false);
      setStatus("Unsupported");
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    setController(ac);
    try {
      const r = await api("/execute", {
        method: "POST",
        body: JSON.stringify({
          language,
          files: files.map((f) => ({ path: f.path, content: f.content })),
          stdin,
        }),
        signal: ac.signal,
      });
      const runOutput =
        [r.stdout, r.stderr]
          .filter(Boolean)
          .join(r.stdout && r.stderr ? "\n" : "") ||
        (r.simulated ? "No output was predicted." : "Process completed without output.");
      setIsAiEstimate(Boolean(r.simulated && !r.blocked));
      setOutput(
        r.blocked
          ? `Execution blocked: ${runOutput}`
          : r.simulated
            ? formatPredictedTerminal(r, language)
            : runOutput,
      );
      setShowPreview(false);
      setStatus(
        r.blocked
          ? "Blocked by AI review"
          : r.simulated
            ? "AI estimate (not executed)"
            : r.timedOut
              ? "Timed out"
              : r.exitCode === 0
                ? "Finished"
                : "Failed",
      );
    } catch (e) {
      if (e.name !== "AbortError") {
        setOutput(e.message || "Execution failed.");
        setShowPreview(false);
        setStatus("Failed");
      }
    } finally {
      setController(null);
      setBusy(false);
    }
  };
  const stop = () => {
    controller?.abort();
    setController(null);
    setBusy(false);
    setStatus("Stopped");
    setOutput("Execution stopped.");
  };
  const selectChallenge = (item) => {
    let selectedFiles = Array.isArray(item.files) ? item.files : [];
    if (!selectedFiles.length) {
      const path =
        item.courseSlug === "html"
          ? "index.html"
          : item.courseSlug === "css"
            ? "style.css"
            : item.courseSlug === "python"
              ? "main.py"
              : "script.js";
      selectedFiles = [{ path, content: item.starter_code || "" }];
    }
    setChallenge(item);
    setReview(null);
    setWorkspace({ files: selectedFiles, folders: [] });
    setActivePath(selectedFiles[0]?.path);
    setShowPreview(selectedFiles[0]?.path?.toLowerCase().endsWith(".html") || false);
    setStatus(`Challenge loaded: ${item.title}`);
  };
  const checkChallenge = async (submit) => {
    if (!challenge || reviewBusy) return;
    const code = files.map((f) => `// ${f.path}\n${f.content}`).join("\n\n");
    if (!code.trim()) return;
    setReviewBusy(true);
    setReview(null);
    setStatus(submit ? "Submitting for XP…" : "AI is checking…");
    try {
      const d = await api(
        `/practice/${challenge.id}/${submit ? "attempt" : "validate"}`,
        {
          method: "POST",
          body: JSON.stringify({ code, action: submit ? "submit" : "run" }),
        },
      );
      setReview(d);
      setOutput(d.feedback || "No feedback was returned.");
      setShowPreview(false);
      setStatus(d.solved ? "Solved! +30 XP" : "Review complete");
    } catch (e) {
      setReview({ correct: false, feedback: e.message });
      setOutput(e.message);
      setShowPreview(false);
      setStatus("Review failed");
    } finally {
      setReviewBusy(false);
    }
  };
  return (
    <>
      <div
        className={
          questionMode ? "codeStudio questionPracticeStudio" : "codeStudio"
        }
      >
        <section className="studioToolbar">
          <div>
            <div className="eyebrow">
              <Code2 size={15} /> {title}
            </div>
            <h1>Build, run, learn.</h1>
            <p className="muted">{description}</p>
          </div>
          <div className={questionMode ? "studioActions questionToolbarActions" : "studioActions"}>
            {busy ? (
              <button className="secondary" onClick={stop}>
                <StopCircle size={16} /> Stop
              </button>
            ) : (
              <button className="primary" onClick={run}>
                <Play size={16} /> Run project
              </button>
            )}
            {showChallenges && challenge && (
              <>
                <button
                  className="secondary"
                  disabled={reviewBusy}
                  onClick={() => checkChallenge(false)}
                >
                  <Bot size={16} /> Check with AI
                </button>
                <button
                  className="secondary"
                  disabled={reviewBusy}
                  onClick={() => checkChallenge(true)}
                >
                  <Trophy size={16} /> Submit · +30 XP
                </button>
              </>
            )}
          </div>
        </section>
        {showChallenges && review && (
          <div
            className={
              review.solved ? "practiceReview success" : "practiceReview"
            }
          >
            <strong>
              {review.solved
                ? "Challenge solved!"
                : review.correct
                  ? "Looks correct, but submit again to record XP."
                  : "AI feedback"}
            </strong>
            <span>{review.feedback}</span>
          </div>
        )}
        <div className="studioGrid">
          <aside className="studioExplorer panel">
            {questionMode ? (
              <div className="questionNavigator">
                <div className="studioPanelTitle">
                  <span>QUESTIONS</span>
                  <small>{challenges.length}</small>
                </div>
                <input
                  className="challengeSearch"
                  value={challengeQuery}
                  onChange={(e) => setChallengeQuery(e.target.value)}
                  placeholder="Find a question…"
                  aria-label="Find a question"
                />
                <div className="challengeList">
                  {filteredChallenges.map((c) => (
                    <div
                      className={
                        challenge?.id === c.id
                          ? "studioChallengeItem active"
                          : "studioChallengeItem"
                      }
                      key={c.id}
                    >
                      <button
                        className="studioChallenge"
                        onClick={() => selectChallenge(c)}
                      >
                        <span className="challengeTitle">
                          {c.solved ? "✓ " : ""}
                          {c.title}
                        </span>
                        <small>
                          {c.difficulty} · {c.courseTitle}
                        </small>
                      </button>
                      {challenge?.id === c.id && (
                        <div className="questionDescription">
                          <div className="questionBriefSection">
                            <strong>What you need to build</strong>
                            <p>{c.description}</p>
                          </div>
                          <div className="questionBriefSection">
                            <strong>How to approach it</strong>
                            <p>
                              Start with the normal case, then test empty,
                              invalid, and repeated input. Keep the solution
                              readable and explain one design decision.
                            </p>
                          </div>
                          <div className="questionExpected">
                            <strong>Expected output</strong>
                            <code>{c.expected}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="questionNavigatorHint">
                  Pick a question, read the brief, then solve it in the editor.
                </div>
              </div>
            ) : (
              <>
                <div className="studioPanelTitle">
                  <span>EXPLORER</span>
                </div>
                <WorkspaceTree
                  files={files}
                  folders={workspace.folders || []}
                  activePath={active?.path}
                  onSelect={selectFile}
                  onAddFile={addFile}
                  onAddFolder={addFolder}
                  onRename={rename}
                  onDelete={remove}
                />
              </>
            )}
            {!questionMode && showChallenges && challenges.length > 0 && (
              <div className="studioChallenges">
                <div className="studioPanelTitle">
                  <span>QUESTION PRACTICE</span>
                  <small>{challenges.length} available</small>
                </div>
                <input
                  className="challengeSearch"
                  value={challengeQuery}
                  onChange={(e) => setChallengeQuery(e.target.value)}
                  placeholder="Search questions…"
                  aria-label="Search practice questions"
                />
                <div className="challengeList">
                  {filteredChallenges.map((c) => (
                    <button
                      className={
                        challenge?.id === c.id
                          ? "studioChallenge active"
                          : "studioChallenge"
                      }
                      key={c.id}
                      onClick={() => selectChallenge(c)}
                    >
                      <span className="challengeTitle">
                        {c.solved ? "✓ " : ""}
                        {c.title}
                      </span>
                      <small>
                        {c.courseTitle} · {c.difficulty}
                        {c.attempts ? ` · ${c.attempts} attempt${c.attempts === 1 ? "" : "s"}` : ""}
                      </small>
                    </button>
                  ))}
                  {!filteredChallenges.length && (
                    <div className="studioChallengeEmpty">
                      No questions match your search.
                    </div>
                  )}
                </div>
              </div>
            )}
            {!questionMode && (
              <div className="studioExplorerHint">
                Changes are saved automatically in this browser. Files are
                never executed on the host.
              </div>
            )}
          </aside>
          <section className="studioEditor panel">
            {questionMode && (
              <div className="questionActionBar">
                {busy ? (
                  <button className="secondary" onClick={stop}>
                    <StopCircle size={16} /> Stop
                  </button>
                ) : (
                  <button className="primary" onClick={run}>
                    <Play size={16} /> Run
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={reviewBusy || !challenge}
                  onClick={() => checkChallenge(false)}
                >
                  <Bot size={16} /> AI check
                </button>
                <button
                  className="secondary"
                  disabled={reviewBusy || !challenge}
                  onClick={() => checkChallenge(true)}
                >
                  <Trophy size={16} /> Submit
                </button>
              </div>
            )}
            <div className="studioTabs">
              {files.map((f) => (
                <button
                  className={
                    f.path === active?.path ? "studioTab active" : "studioTab"
                  }
                  key={f.path}
                  onClick={() => selectFile(f.path)}
                >
                  {f.path}
                  {f.path === active?.path && <span className="tabDot" />}
                </button>
              ))}
            </div>
            {active ? (
              <CodeMirror
                value={active.content}
                height="min(58vh, 560px)"
                theme={oneDark}
                extensions={
                  languageOf(active.path) === "html"
                    ? [html()]
                    : languageOf(active.path) === "css"
                      ? [css()]
                      : languageOf(active.path) === "javascript"
                        ? [javascript({ jsx: true })]
                        : []
                }
                onChange={update}
                basicSetup={{ lineNumbers: true, foldGutter: true }}
              />
            ) : (
              <div className="empty">Create a file to begin.</div>
            )}
            <div className="studioStatus">
              <span
                className={
                  status === "Failed" ||
                  status === "Unsupported" ||
                  status === "Runtime error"
                    ? "statusError"
                    : ""
                }
              >
                {status}
              </span>
              <span>
                {active?.path || "No file"} · {active?.content.length || 0}{" "}
                characters
              </span>
            </div>
          </section>
          <section className="studioOutput panel">
            <div className="studioOutputHead">
              <div className="studioOutputTabs">
                {hasWebActive && <button
                  className={!showPreview ? "active" : ""}
                  onClick={() => setShowPreview(false)}
                >
                  <TerminalSquare size={15} /> Terminal
                </button>}
                {hasWebActive && <button
                  className={showPreview ? "active" : ""}
                  onClick={() => setShowPreview(true)}
                >
                  <Eye size={15} /> Preview
                </button>}
                {!hasWebActive && <span className="studioOutputLabel"><TerminalSquare size={15} /> Terminal output</span>}
                {isAiEstimate && (
                  <span className="studioSimulationNotice">
                    AI estimate · not executed
                  </span>
                )}
              </div>
              <button
                className="iconBtn"
                onClick={() => {
                  setOutput("");
                  setIsAiEstimate(false);
                  setPreview("");
                  setStatus("Ready");
                }}
                title="Clear output"
              >
                <Trash2 size={15} />
              </button>
            </div>
            {showPreview && hasWebActive ? (
              <div className="studioPreviewWrap">
                {preview ? (
                  <iframe
                    ref={previewFrameRef}
                    title="Sandboxed project preview"
                    sandbox="allow-scripts"
                    srcDoc={preview}
                    onLoad={() => setStatus("Finished")}
                  />
                ) : (
                  <div className="studioEmptyOutput">
                    <Eye size={24} />
                    <p>Run a web project to see its sandboxed preview.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="studioTerminal">
                <pre>
                  {output ||
                    (hasWebActive
                      ? "Browser console is empty. Use console.log() in your JavaScript to see output here."
                      : "Run your project to see output here.")}
                </pre>
                <label className="stdinBox">
                  <span>Standard input (optional)</span>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Input passed to server-side programs…"
                    rows={3}
                  />{" "}
                </label>
              </div>
            )}
          </section>
          {questionMode && (
            <TutorMini
              active={challenge}
              code={tutorCode}
              questionMode
            />
          )}
        </div>
      </div>
      {dialog && (
        <WorkspaceDialog
          title={
            dialog.mode === "create-file"
              ? "Create file"
              : dialog.mode === "create-folder"
                ? "Create folder"
                : `Rename ${dialog.isFolder ? "folder" : "file"}`
          }
          value={dialog.value}
          onChange={(value) => setDialog({ ...dialog, value })}
          onCancel={() => setDialog(null)}
          onSubmit={() => submitDialog(dialog.value)}
        />
      )}
    </>
  );
}
function Projects() {
  const initial = {
    files: [
      {
        path: "index.html",
        content:
          '<main class="welcome">\n  <h1>My project</h1>\n  <p>Start building here.</p>\n</main>',
      },
      {
        path: "style.css",
        content: ".welcome { font-family: system-ui; padding: 2rem; }",
      },
      { path: "script.js", content: 'console.log("Hello from your project");' },
    ],
    folders: [],
  };
  const [projects, setProjects] = useState(() =>
    safeLoad("learny_projects", []).map((p) => ({
      ...p,
      files: p.files?.length
        ? p.files
        : p.code
          ? [{ path: "index.js", content: p.code }]
          : initial.files.map((f) => ({ ...f })),
      folders: p.folders || [],
    })),
  );
  const [active, setActive] = useState(null);
  const create = () => {
    const p = {
      id: crypto.randomUUID(),
      name: "Untitled project",
      description: "",
      ...initial,
      files: initial.files.map((f) => ({ ...f })),
    };
    setProjects((x) => [p, ...x]);
    setActive(p.id);
  };
  const current = projects.find((p) => p.id === active);
  const updateProject = (patch) =>
    setProjects((x) =>
      x.map((p) => (p.id === active ? { ...p, ...patch } : p)),
    );
  useEffect(
    () => localStorage.setItem("learny_projects", JSON.stringify(projects)),
    [projects],
  );
  return (
    <>
      <section className="pageIntro">
        <div>
          <div className="eyebrow">
            <FolderKanban size={15} /> Build workspace
          </div>
          <h1>My Projects</h1>
          <p className="muted">
            Organize ideas in a VS Code-like multi-file workspace. Projects stay
            in this browser.
          </p>
        </div>
        <button className="primary" onClick={create}>
          <Plus size={16} /> New project
        </button>
      </section>
      {current ? (
        <>
          <div className="projectMeta panel">
            <input
              className="noteTitle"
              value={current.name}
              onChange={(e) => updateProject({ name: e.target.value })}
            />
            <input
              className="projectDescription"
              value={current.description}
              onChange={(e) => updateProject({ description: e.target.value })}
              placeholder="What are you building?"
            />
            <button
              className="secondary danger"
              onClick={() => {
                if (confirm("Delete this project and all its files?")) {
                  setProjects((x) => x.filter((p) => p.id !== active));
                  setActive(null);
                }
              }}
            >
              <Trash2 size={15} /> Delete project
            </button>
          </div>
          <WorkspaceEditor
            key={current.id}
            title={current.name}
            description="Create files and folders, then run the whole project safely."
            storageKey={`learny_project_${current.id}`}
            initialFiles={current.files}
          />
        </>
      ) : (
        <div className="projectsLayout">
          <aside className="panel projectList">
            {projects.map((p) => (
              <button
                key={p.id}
                className="noteRow"
                onClick={() => setActive(p.id)}
              >
                <FolderKanban size={16} />
                <span>
                  <b>{p.name}</b>
                  <small>{p.description || "Personal project"}</small>
                </span>
              </button>
            ))}
            {!projects.length && (
              <div className="empty">Create your first project.</div>
            )}
          </aside>
          <div className="panel projectEditor projectEmpty">
            <div className="empty">
              Select a project or create one to start building.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function Practice() {
  const initial = [
    {
      path: "index.html",
      content:
        '<main class="welcome">\n  <h1>Hello, Learner!</h1>\n  <p>Edit the files and press Run to preview your work.</p>\n</main>',
    },
    {
      path: "style.css",
      content:
        ".welcome { font-family: system-ui, sans-serif; color: #f7f7fb; background: #171b30; padding: 2rem; border-radius: 1rem; }",
    },
    {
      path: "script.js",
      content:
        'document.querySelector("h1")?.addEventListener("click", () => { document.querySelector("h1").textContent = "Nice work!"; });',
    },
  ];
  const [mode, setMode] = useState("open");
  return (
    <>
      <section className="practiceIntro">
        <div>
          <div className="eyebrow">
            <Code2 size={15} /> Practice Lab
          </div>
          <h1>Practice your way.</h1>
          <p className="muted">
            Solve a guided question with feedback, or open a blank workspace and
            build anything you want.
          </p>
        </div>
        <div className="practiceModeTabs" role="tablist" aria-label="Practice mode">
          <button
            className={mode === "open" ? "selected" : ""}
            onClick={() => setMode("open")}
            role="tab"
            aria-selected={mode === "open"}
          >
            <FolderKanban size={16} /> Main practice
          </button>
          <button
            className={mode === "questions" ? "selected" : ""}
            onClick={() => setMode("questions")}
            role="tab"
            aria-selected={mode === "questions"}
          >
            <ClipboardList size={16} /> Question practice
          </button>
        </div>
      </section>
      {mode === "questions" ? (
        <WorkspaceEditor
          title="Guided Question Practice"
          description="Choose a challenge, inspect the requirements, write your solution, and use AI feedback before submitting for XP."
          storageKey="learny_question_practice_workspace"
          initialFiles={initial}
          showChallenges
          questionMode
        />
      ) : (
        <WorkspaceEditor
          title="Main Practice Workspace"
          description="Experiment freely with HTML, CSS, JavaScript, Python, and other supported languages. Your files save automatically in this browser."
          storageKey="learny_practice_workspace"
          initialFiles={initial}
        />
      )}
    </>
  );
}
function TutorMini({ active, code, questionMode = false }) {
  const [consent, setConsent] = useState(true),
    [input, setInput] = useState(""),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [coachMode, setCoachMode] = useState("manual");
  const ask = async (
    text = input ||
      (active
        ? `Review my solution for "${active.title}" and give one useful hint without writing the full answer.`
        : "Review my current code and tell me the most important improvement."),
  ) => {
    if (!consent) return;
    setBusy(true);
    try {
      const d = await api("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          provider: "gemini",
          mode: "text",
          action: "review",
          message: text,
          context: {
            page: "practice",
            challenge: active?.title,
            language: active?.courseSlug,
            code,
          },
        }),
      });
      setAnswer(d.answer);
    } catch (e) {
      setAnswer(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!questionMode || coachMode !== "live" || !consent || code.trim().length < 12)
      return undefined;
    const timer = setTimeout(() => {
      ask(
        `Act as a live coding coach. Inspect the student's current code for "${active?.title || "an open practice task"}". Point out the first concrete issue or confirm what is working. Do not provide the complete solution. Current code:\n${code}`,
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [code, coachMode, consent, questionMode, active?.id]);
  return (
    <aside className="tutorCard questionTutor">
      <div className="tutorTop">
        <div className="tutorBrand">
          <span className="tutorIcon">
            <Bot size={18} />
          </span>
          <div>
            <b>AI Coach</b>
            <small>{questionMode ? "Help is always available" : "Review your code while you practice"}</small>
          </div>
        </div>
        <button className="iconBtn" onClick={() => setConsent((v) => !v)}>
          {consent ? <Eye size={17} /> : <EyeOff size={17} />}
        </button>
      </div>
      {questionMode && (
        <div className="tutorModeTabs">
          <button
            className={coachMode === "manual" ? "active" : ""}
            onClick={() => setCoachMode("manual")}
          >
            Manual
          </button>
          <button
            className={coachMode === "live" ? "active" : ""}
            onClick={() => setCoachMode("live")}
          >
            Live coach
          </button>
        </div>
      )}
      <div className="tutorAnswer">
        {busy
          ? "Tutor is thinking…"
          : answer || "Ask for a code review, hint or explanation."}
      </div>
      <div className="tutorInput">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question or request a hint…"
          rows={2}
        />
        <button className="primary" disabled={busy || !consent} onClick={() => ask()}>
          <Send size={15} />
        </button>
      </div>
      {questionMode && coachMode === "live" && (
        <small className="tutorLiveHint">
          Live coach checks your code after you pause typing. It gives hints,
          not copied solutions.
        </small>
      )}
    </aside>
  );
}

function TutorMessageContent({ content, onCopy }) {
  const parts = String(content || "").split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("```") ? (
          <div className="codeBlock" key={index}>
            <div className="codeBlockHead">
              <span>{part.match(/^```([^\n]*)/)?.[1] || "code"}</span>
              <button
                className="iconBtn"
                onClick={() =>
                  onCopy(part.replace(/^```[^\n]*\n?/, "").replace(/```$/, ""))
                }
              >
                <Copy size={13} /> Copy
              </button>
            </div>
            <pre>
              <code>
                {part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}
              </code>
            </pre>
          </div>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function TutorChat() {
  const { user } = useAuth();
  const storageKey = `learny_tutor_chats_${user?.id || user?.username || "student"}`;
  const [overview, setOverview] = useState(null),
    [provider, setProvider] = useState("gemini"),
    [mode, setMode] = useState("text"),
    [consent, setConsent] = useState(true),
    [action, setAction] = useState("ask"),
    [draft, setDraft] = useState(""),
    [sessions, setSessions] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || "[]");
      } catch {
        return [];
      }
    }),
    [activeId, setActiveId] = useState(null),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [renameDialog, setRenameDialog] = useState(null);
  useEffect(() => {
    api("/tutor/overview").then(setOverview);
  }, []);
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);
  const active = sessions.find((x) => x.id === activeId) || null;
  const createChat = () => {
    const chat = {
      id: crypto.randomUUID(),
      title: "New conversation",
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions((x) => [chat, ...x]);
    setActiveId(chat.id);
    setDraft("");
    return chat;
  };
  useEffect(() => {
    if (!activeId && sessions[0]) setActiveId(sessions[0].id);
  }, [activeId, sessions]);
  const removeChat = (id) => {
    setSessions((x) => x.filter((s) => s.id !== id));
    if (id === activeId) setActiveId(null);
  };
  const renameChat = (chat) =>
    setRenameDialog({ id: chat.id, value: chat.title });
  const submitRename = () => {
    const title = renameDialog?.value.trim();
    if (title)
      setSessions((x) =>
        x.map((s) => (s.id === renameDialog.id ? { ...s, title } : s)),
      );
    setRenameDialog(null);
  };
  const ask = async (actionOverride = action, preset = draft) => {
    if (!consent || !overview) return;
    const text = preset.trim();
    if (!text) return;
    const chat = active || createChat();
    const targetId = chat.id;
    const userMessage = {
      role: "user",
      content: text,
      id: crypto.randomUUID(),
    };
    const assistantId = crypto.randomUUID();
    setDraft("");
    setBusy(true);
    setSessions((x) =>
      x.map((s) =>
        s.id === targetId
          ? {
              ...s,
              title: s.messages.length
                ? s.title
                : text.length > 34
                  ? `${text.slice(0, 34)}…`
                  : text,
              updatedAt: Date.now(),
              messages: [
                ...s.messages,
                userMessage,
                {
                  role: "assistant",
                  content: "",
                  id: assistantId,
                  loading: true,
                },
              ],
            }
          : s,
      ),
    );
    try {
      const d = await api("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          provider,
          mode,
          action: actionOverride,
          message: text,
          context: {
            page: "tutor",
            progress: overview.progress,
            conversation: chat.messages
              .slice(-8)
              .map((m) => ({ role: m.role, content: m.content })),
          },
        }),
      });
      setSessions((x) =>
        x.map((s) =>
          s.id === targetId
            ? {
                ...s,
                updatedAt: Date.now(),
                messages: s.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: d.answer, loading: false }
                    : m,
                ),
              }
            : s,
        ),
      );
      if (mode === "voice" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(d.answer));
      }
    } catch (e) {
      setSessions((x) =>
        x.map((s) =>
          s.id === targetId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: `Sorry, I couldn't complete that request.\n\n${e.message}`,
                        loading: false,
                        error: true,
                      }
                    : m,
                ),
              }
            : s,
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const quick = [
    ["explain", "Explain", "Break down a topic step by step."],
    ["summarize", "Summarize", "Turn text into clear study points."],
    ["note", "Make notes", "Create a polished study note."],
    ["quiz", "Take a test", "Generate a 5-question test."],
    ["code", "Generate code", "Build production-minded code."],
    ["review", "Review code", "Find bugs and explain the fix."],
  ];
  const visible = sessions
    .filter(
      (s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.messages.some((m) =>
          m.content.toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (!overview) return <PageLoading />;
  return (
    <div className={sidebarOpen ? "tutorWorkspace" : "tutorWorkspace full"}>
      <aside className={sidebarOpen ? "tutorSidebar" : "tutorSidebar closed"}>
        <div className="tutorSidebarHead">
          <div className="tutorSidebarBrand">
            <span className="tutorIcon">
              <Bot size={18} />
            </span>
            <div>
              <b>Learny Tutor</b>
              <small>Study smarter with AI</small>
            </div>
          </div>
        </div>
        <button className="primary newChatBtn" onClick={createChat}>
          <Plus size={16} /> New chat
        </button>
        <label className="tutorSearch">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
          />
        </label>
        <div className="historyLabel">Your chats</div>
        <div className="sessionList">
          {visible.map((s) => (
            <div
              className={s.id === activeId ? "sessionRow active" : "sessionRow"}
              key={s.id}
            >
              <button onClick={() => setActiveId(s.id)}>
                <MessageSquare size={15} />
                <span>{s.title}</span>
              </button>
              <div className="sessionMenu">
                <button
                  className="iconBtn"
                  onClick={() => renameChat(s)}
                  title="Rename chat"
                >
                  <MoreHorizontal size={15} />
                </button>
                <button
                  className="iconBtn danger"
                  onClick={() => removeChat(s.id)}
                  title="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {!visible.length && (
            <div className="historyEmpty">
              No saved chats yet.
              <br />
              Start a new conversation.
            </div>
          )}
        </div>
        <div className="tutorSidebarFoot">
          <Lock size={14} />
          <span>Your chats stay in this browser.</span>
        </div>
      </aside>
      <main className="tutorConversation">
        <header className="tutorConversationHead">
          <button
            className="iconBtn"
            onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle history"
          >
            <PanelLeft size={17} />
          </button>
          <div>
            <b>{active?.title || "New conversation"}</b>
            <small>{active?.messages.length || 0} messages</small>
          </div>
          <span className="secure">
            <Lock size={13} /> Private
          </span>
        </header>
        {!active ? (
          <div className="tutorWelcome">
            <div className="tutorWelcomeIcon">
              <WandSparkles size={32} />
            </div>
            <h1>How can I help you learn?</h1>
            <p>
              Ask anything about coding, courses, or study topics. Your
              conversations are saved here so you can continue anytime.
            </p>
            <div className="welcomePrompts">
              {[
                "Explain JavaScript promises",
                "Help me understand React state",
                "Quiz me on CSS flexbox",
                "Review my code",
              ].map((x) => (
                <button
                  key={x}
                  onClick={() => {
                    createChat();
                    setDraft(x);
                  }}
                >
                  {x}
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="messageList">
              {active.messages.map((m) => (
                <div
                  className={
                    m.role === "user"
                      ? "chatMessage user"
                      : "chatMessage assistant"
                  }
                  key={m.id}
                >
                  <div className="messageAvatar">
                    {m.role === "user" ? (
                      <UserCircle size={18} />
                    ) : (
                      <Bot size={18} />
                    )}
                  </div>
                  <div className="messageBody">
                    <div className="messageMeta">
                      {m.role === "user" ? "You" : "Learny Tutor"}
                      <button
                        className="messageCopy"
                        onClick={() =>
                          navigator.clipboard?.writeText(m.content)
                        }
                        title="Copy message"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                    <div className="messageContent">
                      {m.loading ? (
                        <span className="thinking">
                          <i /> <i /> <i />
                        </span>
                      ) : (
                        <TutorMessageContent
                          content={m.content}
                          onCopy={(text) =>
                            navigator.clipboard?.writeText(text)
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="tutorComposerWrap">
          <div className="quickActions">
            {quick.map(([a, label]) => (
              <button
                className={action === a ? "selected" : ""}
                key={a}
                onClick={() => setAction(a)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="tutorComposer">
            <button
              className="iconBtn"
              onClick={() => startSpeech(setDraft)}
              title="Use voice input"
            >
              <Mic size={17} />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              placeholder="Message Learny Tutor…"
              rows={1}
            />
            <button
              className="primary sendBtn"
              disabled={busy || !draft.trim() || !consent}
              onClick={() => ask()}
            >
              {busy ? (
                <RotateCcw size={16} className="spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <div className="composerFooter">
            <div className="tutorControls">
              <button
                className={provider === "gemini" ? "selected" : ""}
                onClick={() => setProvider("gemini")}
              >
                Gemini
              </button>
              <button
                className={provider === "openai" ? "selected" : ""}
                onClick={() => setProvider("openai")}
              >
                OpenAI
              </button>
              <button
                className={mode === "voice" ? "selected" : ""}
                onClick={() => setMode(mode === "voice" ? "text" : "voice")}
              >
                <Volume2 size={14} /> {mode === "voice" ? "Voice on" : "Voice"}
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                Include learning progress
              </label>
            </div>
            <span>Enter to send · Shift + Enter for a new line</span>
          </div>
        </div>
      </main>
      <aside className="tutorInfo">
        <div className="panel">
          <h3>Study snapshot</h3>
          <div className="profileStat">
            <b>Lessons</b>
            <span>
              {overview.progress.completedLessons}/
              {overview.progress.totalLessons}
            </span>
          </div>
          <div className="profileStat">
            <b>Progress</b>
            <span>{overview.progress.percent}%</span>
          </div>
          <div className="profileStat">
            <b>Challenges</b>
            <span>
              {overview.progress.solved}/{overview.progress.challenges}
            </span>
          </div>
        </div>
        <div className="panel tutorTips">
          <h3>Try asking</h3>
          <p>“Explain this like I’m new to coding.”</p>
          <p>“Give me a hint, not the answer.”</p>
          <p>“Quiz me one question at a time.”</p>
        </div>
      </aside>
      {renameDialog && (
        <WorkspaceDialog
          title="Rename conversation"
          value={renameDialog.value}
          onChange={(value) => setRenameDialog({ ...renameDialog, value })}
          onCancel={() => setRenameDialog(null)}
          onSubmit={submitRename}
        />
      )}
    </div>
  );
}

function Tutor() {
  const [overview, setOverview] = useState(null),
    [provider, setProvider] = useState("gemini"),
    [mode, setMode] = useState("text"),
    [consent, setConsent] = useState(true),
    [action, setAction] = useState("ask"),
    [message, setMessage] = useState(""),
    [lastPrompt, setLastPrompt] = useState(""),
    [answer, setAnswer] = useState(""),
    [history, setHistory] = useState([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/tutor/overview").then(setOverview);
  }, []);
  const ask = async (actionOverride = action, preset = message) => {
    if (!consent) {
      setAnswer("Enable learning context consent first.");
      return;
    }
    const text = preset || message;
    if (!text.trim()) return;
    setMessage("");
    setLastPrompt(text);
    setBusy(true);
    try {
      const d = await api("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          provider,
          mode,
          action: actionOverride,
          message: text,
          context: { page: "tutor", progress: overview?.progress },
        }),
      });
      setAnswer(d.answer);
      setHistory((h) => [...h, { question: text, answer: d.answer }]);
      if (mode === "voice" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(d.answer));
      }
    } catch (e) {
      setAnswer(e.message);
    } finally {
      setBusy(false);
    }
  };
  const quick = [
    ["explain", "Explain", "Explain a topic simply with an example."],
    ["summarize", "Summarize", "Summarize a topic or text into study points."],
    ["note", "Make notes", "Create a polished study note for a topic."],
    ["quiz", "Take a test", "Generate a 5-question test and answer key."],
    ["code", "Generate code", "Generate useful, production-minded code."],
    ["review", "Review code", "Find bugs and explain the smallest fix."],
  ];
  if (!overview) return <PageLoading />;
  return (
    <div className="tutorPage">
      <section className="pageIntro">
        <div>
          <div className="eyebrow">
            <Bot size={15} /> Personal coding and study mentor
          </div>
          <h1>Your AI Tutor</h1>
          <p className="muted">
            Ask naturally, use voice input, generate notes/tests/code, summarize
            material, or review your code.
          </p>
        </div>
        <span className="secure">
          <Lock size={14} /> Keys stay server-side
        </span>
      </section>
      <div className="tutorGrid">
        <section className="panel tutorMain">
          <div className="tutorHero">
            <div className="tutorHeroIcon">
              <WandSparkles size={28} />
            </div>
            <div>
              <h2>What do you want to do?</h2>
              <p>
                The tutor only receives the context Learny explicitly sends. It
                cannot access unrelated device data.
              </p>
            </div>
          </div>
          <div className="actionGrid">
            {quick.map(([a, label, desc]) => (
              <button
                key={a}
                className={action === a ? "actionCard selected" : "actionCard"}
                onClick={() => setAction(a)}
              >
                <b>{label}</b>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          <div className="tutorControls big">
            <button
              className={provider === "gemini" ? "selected" : ""}
              onClick={() => setProvider("gemini")}
            >
              Gemini
            </button>
            <button
              className={provider === "openai" ? "selected" : ""}
              onClick={() => setProvider("openai")}
            >
              OpenAI
            </button>
            <button
              className={mode === "text" ? "selected" : ""}
              onClick={() => setMode("text")}
            >
              <Send size={15} /> Text
            </button>
            <button
              className={mode === "voice" ? "selected" : ""}
              onClick={() => setMode("voice")}
            >
              <Volume2 size={15} /> Voice
            </button>
          </div>
          <label className="toggleRow">
            <span>
              <b>Learning context consent</b>
              <small>
                Allow progress and the current task context to be included.
              </small>
            </span>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
          </label>
          <div className="promptChips">
            {[
              "JavaScript promises",
              "CSS flexbox",
              "React state",
              "SQL joins",
            ].map((x) => (
              <button
                key={x}
                className="chip"
                onClick={() => {
                  setMessage(x);
                  setAction("explain");
                }}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="chatBox">
            <div className="tutorChatHistory">
              {history.slice(-8, -1).map((item, index) => (
                <div
                  className="tutorHistoryItem"
                  key={`${item.question}-${index}`}
                >
                  <b>You</b>
                  <span>{item.question}</span>
                </div>
              ))}
            </div>
            <div className="tutorAnswerViewport">
              <div className="tutorQuestion">
                {lastPrompt && (
                  <>
                    <b>You</b>
                    <span>{lastPrompt}</span>
                  </>
                )}
              </div>
              <div className="tutorAnswer large">
                {busy
                  ? "Tutor is thinking…"
                  : answer || "Choose an action, enter a topic, and ask away."}
              </div>
            </div>
            <div className="chatInput">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  action === "note"
                    ? "Topic for your note…"
                    : action === "quiz"
                      ? "Topic for your test…"
                      : "Ask or describe what you need…"
                }
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
              />
              <button
                className="iconBtn"
                onClick={() => startSpeech(setMessage, setBusy)}
                title="Voice input"
              >
                <Mic size={17} />
              </button>
              <button
                className="primary"
                onClick={() => ask()}
                disabled={busy || !message.trim()}
              >
                {busy ? "…" : "Ask"} <Send size={16} />
              </button>
            </div>
            {mode === "voice" && (
              <div className="voiceNote">
                <Volume2 size={16} /> Voice mode reads the answer aloud in your
                browser.
              </div>
            )}
          </div>
          <div className="answerActions">
            <button
              className="secondary"
              onClick={() => navigator.clipboard?.writeText(answer || "")}
              disabled={!answer}
            >
              <Copy size={15} /> Copy
            </button>
            {answer && (
              <Link
                className="secondary"
                to="/notes"
                state={{
                  draft: {
                    title: lastPrompt || "AI Note",
                    content: answer,
                    source: "ai",
                  },
                }}
              >
                <StickyNote size={15} /> Save as note
              </Link>
            )}
          </div>
        </section>
        <aside>
          <div className="panel">
            <h2>Student snapshot</h2>
            <div className="profileStat">
              <b>Lessons</b>
              <span>
                {overview.progress.completedLessons}/
                {overview.progress.totalLessons}
              </span>
            </div>
            <div className="profileStat">
              <b>Progress</b>
              <span>{overview.progress.percent}%</span>
            </div>
            <div className="profileStat">
              <b>Challenges solved</b>
              <span>
                {overview.progress.solved}/{overview.progress.challenges}
              </span>
            </div>
          </div>
          <div className="panel">
            <h2>Best workflow</h2>
            <p className="muted">
              Learn → ask for an explanation → make notes → take a test →
              practice code → review your mistakes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
function startSpeech(setMessage) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setMessage(
      "Voice input is not supported in this browser. Try Edge or Chrome.",
    );
    return;
  }
  const r = new SR();
  r.lang = navigator.language || "en-US";
  r.interimResults = false;
  r.onresult = (e) => setMessage(e.results[0][0].transcript);
  r.start();
}

function Notes() {
  const location = useLocation();
  const [notes, setNotes] = useState([]),
    [active, setActive] = useState(null),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [topic, setTopic] = useState(""),
    [busy, setBusy] = useState(false),
    [saveBusy, setSaveBusy] = useState(false);
  useEffect(() => {
    api("/notes").then((x) => setNotes(x.notes));
  }, []);
  useEffect(() => {
    if (location.state?.draft) {
      setTitle(location.state.draft.title || "AI Study Note");
      setContent(location.state.draft.content || "");
    }
  }, [location.state]);
  const newNote = () => {
    setActive(null);
    setTitle("");
    setContent("");
  };
  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaveBusy(true);
    try {
      if (active) {
        const d = await api(`/notes/${active.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            content,
            source: active.source || "manual",
          }),
        });
        setNotes(notes.map((n) => (n.id === active.id ? d.note : n)));
        setActive(d.note);
      } else {
        const d = await api("/notes", {
          method: "POST",
          body: JSON.stringify({ title, content, source: "manual" }),
        });
        setNotes([d.note, ...notes]);
        setActive(d.note);
      }
    } finally {
      setSaveBusy(false);
    }
  };
  const remove = async () => {
    if (!active) return;
    if (!confirm("Delete this note?")) return;
    await api(`/notes/${active.id}`, { method: "DELETE" });
    setNotes(notes.filter((n) => n.id !== active.id));
    newNote();
  };
  const aiNote = async () => {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const d = await api("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          provider: "gemini",
          mode: "text",
          action: "note",
          message: topic,
          context: { page: "notes" },
        }),
      });
      setTitle(topic);
      setContent(d.answer);
      setActive(null);
    } catch (e) {
      setContent(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="notesPage">
      <section className="pageIntro">
        <div>
          <div className="eyebrow">
            <StickyNote size={15} /> Personal knowledge base
          </div>
          <h1>My Notes</h1>
          <p className="muted">
            Write notes yourself or ask AI to turn any topic into a study note.
          </p>
        </div>
        <button className="primary" onClick={newNote}>
          <Plus size={16} /> New note
        </button>
      </section>
      <div className="notesLayout">
        <aside className="notesList">
          <div className="notesSearch">
            <Search size={16} />
            <input
              placeholder="Search notes…"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                setNotes((n) =>
                  n.filter(
                    (x) =>
                      x.title.toLowerCase().includes(q) ||
                      x.content.toLowerCase().includes(q),
                  ),
                );
              }}
            />
          </div>
          {notes.map((n) => (
            <button
              key={n.id}
              className={active?.id === n.id ? "noteRow active" : "noteRow"}
              onClick={() => {
                setActive(n);
                setTitle(n.title);
                setContent(n.content);
              }}
            >
              <StickyNote size={16} />
              <span>
                <b>{n.title}</b>
                <small>{n.source === "ai" ? "AI note" : "Personal note"}</small>
              </span>
            </button>
          ))}
          {!notes.length && <div className="empty">No notes yet.</div>}
        </aside>
        <section className="panel noteEditor">
          <div className="aiNoteBar">
            <div>
              <b>AI note maker</b>
              <small>
                Enter a topic and let Gemini create a structured note.
              </small>
            </div>
            <div className="aiNoteInput">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. JavaScript closures"
              />
              <button className="secondary" disabled={busy} onClick={aiNote}>
                {busy ? (
                  <RefreshCw className="spin" size={15} />
                ) : (
                  <WandSparkles size={15} />
                )}{" "}
                Generate
              </button>
            </div>
          </div>
          <input
            className="noteTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
          />
          <textarea
            className="noteContent"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing…"
          />
          <div className="noteActions">
            <button
              className="primary"
              disabled={saveBusy || !title.trim() || !content.trim()}
              onClick={save}
            >
              <Save size={15} /> {saveBusy ? "Saving…" : "Save note"}
            </button>
            {active && (
              <button className="secondary danger" onClick={remove}>
                <Trash2 size={15} /> Delete
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Profile() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    api("/profile").then(setD);
  }, []);
  if (!d) return <PageLoading />;
  return (
    <>
      <section className="profileHero">
        <div className="bigAvatar">{user.displayName[0]}</div>
        <div>
          <div className="eyebrow">Your profile</div>
          <h1>{user.displayName}</h1>
          <p className="muted">
            @{user.username} • {user.email}
          </p>
        </div>
        <div className="profileXP">
          <Star size={17} /> {user.xp} XP
        </div>
      </section>
      <div className="profileGrid">
        <div className="panel">
          <h2>Learning snapshot</h2>
          <div className="profileStat">
            <b>Level</b>
            <span>{Math.floor(user.xp / 100) + 1}</span>
          </div>
          <div className="profileStat">
            <b>Current streak</b>
            <span>{user.streak} days</span>
          </div>
          <div className="profileStat">
            <b>Member since</b>
            <span>{new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="profileStat">
            <b>Email verification</b>
            <span>{user.emailVerified ? "Verified" : "Pending"}</span>
          </div>
        </div>
        <div className="panel">
          <h2>Bookmarks</h2>
          {d.bookmarks.length ? (
            d.bookmarks.map((x) => (
              <Link
                className="bookmarkRow"
                to={`/lesson/${x.slug}`}
                key={x.slug}
              >
                <Bookmark size={17} fill="currentColor" />
                <span>
                  <b>{x.title}</b>
                  <small>{x.courseTitle}</small>
                </span>
                <ChevronRight size={17} />
              </Link>
            ))
          ) : (
            <div className="empty">Bookmark lessons you want to revisit.</div>
          )}
        </div>
      </div>
    </>
  );
}
function SettingsPage() {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false),
    [reducedMotion, setReducedMotion] = useState(
      () => localStorage.getItem("learny_reduced_motion") === "true",
    ),
    [compact, setCompact] = useState(
      () => localStorage.getItem("learny_compact") === "true",
    ),
    [notifications, setNotifications] = useState(
      () => localStorage.getItem("learny_notifications") !== "false",
    );
  useEffect(() => {
    document.documentElement.classList.toggle("reducedMotion", reducedMotion);
    document.documentElement.classList.toggle("compactMode", compact);
  }, [reducedMotion, compact]);
  const save = async (theme) => {
    setSaving(true);
    try {
      const d = await api("/settings", {
        method: "PATCH",
        body: JSON.stringify({ theme }),
      });
      setUser(d.user);
      applyTheme(theme);
    } finally {
      setSaving(false);
    }
  };
  const local = (key, value, setter) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };
  return (
    <>
      <section className="pageIntro">
        <div>
          <div className="eyebrow">
            <Settings size={15} /> Preferences
          </div>
          <h1>Settings</h1>
          <p className="muted">
            Personalize your workspace and keep your learning data protected.
          </p>
        </div>
      </section>
      <div className="settingsPanel">
        <div className="settingRow">
          <div>
            <b>Theme</b>
            <small>Choose dark, light, or follow your device setting.</small>
          </div>
          <div className="themeBtns">
            <button
              className={user.theme === "dark" ? "selected" : ""}
              onClick={() => save("dark")}
              disabled={saving}
            >
              <Moon size={16} /> Dark
            </button>
            <button
              className={user.theme === "light" ? "selected" : ""}
              onClick={() => save("light")}
              disabled={saving}
            >
              <Sun size={16} /> Light
            </button>
            <button
              className={user.theme === "system" ? "selected" : ""}
              onClick={() => save("system")}
              disabled={saving}
            >
              System
            </button>
          </div>
        </div>
        <div className="settingRow">
          <div>
            <b>Reduce motion</b>
            <small>
              Disable most interface animations for a calmer experience.
            </small>
          </div>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) =>
              local("learny_reduced_motion", e.target.checked, setReducedMotion)
            }
          />
        </div>
        <div className="settingRow">
          <div>
            <b>Compact workspace</b>
            <small>
              Use tighter spacing across navigation and learning panels.
            </small>
          </div>
          <input
            type="checkbox"
            checked={compact}
            onChange={(e) =>
              local("learny_compact", e.target.checked, setCompact)
            }
          />
        </div>
        <div className="settingRow">
          <div>
            <b>Learning reminders</b>
            <small>
              Allow Learny to show in-app progress and study reminders.
            </small>
          </div>
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) =>
              local("learny_notifications", e.target.checked, setNotifications)
            }
          />
        </div>
        <div className="settingRow">
          <div>
            <b>Authentication</b>
            <small>
              Password hashes, rate limits, and HttpOnly session cookies protect
              your account.
            </small>
          </div>
          <span className="secure">
            <Lock size={15} /> Protected
          </span>
        </div>
        <div className="settingRow">
          <div>
            <b>Code execution</b>
            <small>
              Browser JavaScript/HTML run inside a sandboxed iframe. Server-side
              Python/Node execution is intentionally disabled.
            </small>
          </div>
          <span className="secure">Safe mode</span>
        </div>
      </div>
      {saving && <div className="toast">Saving…</div>}
    </>
  );
}
function PageLoading() {
  return (
    <div className="pageLoading">
      <div className="loader" />
    </div>
  );
}
function AppRoot() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
createRoot(document.getElementById("root")).render(<AppRoot />);
