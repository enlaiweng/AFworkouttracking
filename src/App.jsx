import { useState, useEffect, useRef } from "react";

// ---------- Roster (source of truth also lives in D1 members table) ----------
const ROSTER = [
  "Aidan Duarte", "Alisa Revi", "Anoush Krochian", "Cathleen Avalos",
  "Chris Blank", "Chris Retama", "Dan Varney", "Dave Reveley",
  "Debbie Bushong", "Enlai Weng", "Evelyn Delgado", "Ge Wu",
  "Greg Crouse", "Heidi Stone", "Jana Remy", "Jason Teh-Mitchell",
  "Jeff Kiesel", "Jeff Liu", "Jen Woo", "Jim Tiao", "Joel Centeno",
  "Josie Badeaux", "Judy Lee", "Julius Schram", "Karin Monroe",
  "Katie Vuong", "Laurel Terreri", "Lisa Korney", "Lynda Razo",
  "Manny Santoyo", "Mary Swetka Yu", "Mauricio Centeno",
  "Michael Johnson", "Michael Yu", "Mica Palomares", "Nea Tatupu",
  "Nick Pon", "Rachelle Reyes", "Robyn Utu", "Roldan Reyes",
  "Sally Flowers", "Sergent Buenaventura", "Skip Marler",
  "Steve Kashynski", "Tom Harvey", "Vahe Krochian",
];

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const teamOf = (name) => {
  const c = name.trim().charAt(0).toUpperCase();
  return c >= "A" && c <= "J" ? "Blue" : "Red";
};

const ACTIVITIES = [
  { id: "cardio", label: "Cardio", rate: 20, hint: "1 point per 20 minutes" },
  { id: "strength", label: "Strength", rate: 20, hint: "1 point per 20 minutes" },
  { id: "stretching", label: "Stretching", rate: 10, hint: "1 point per 10 minutes" },
];

const pointsFor = (minutes, rate) => {
  const m = Number(minutes);
  if (!m || m <= 0) return 0;
  return Math.floor((m / rate) * 2) / 2; // half points count
};

const pad = (n) => String(n).padStart(2, "0");
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NOW = new Date();
const TODAY = localISO(NOW);
const MONTH_KEY = TODAY.slice(0, 7);
const MONTH_LABEL = NOW.toLocaleString("en-US", { month: "long", year: "numeric" });

const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtPts = (p) => (Number.isInteger(p) ? String(p) : p.toFixed(1));
const safePts = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// ---------- Identity: this device only (localStorage) ----------
const ME_KEY = "afc-me";
function readIdentity() {
  try {
    const raw = localStorage.getItem(ME_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && saved.name && ROSTER.includes(saved.name)) {
      return { name: saved.name, slug: slugify(saved.name), team: teamOf(saved.name) };
    }
  } catch {}
  return null;
}

// ---------- API client (Cloudflare Pages Functions + D1) ----------
async function apiFetch(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
const api = {
  myEntries: (slug, month) =>
    apiFetch(`/api/entries?slug=${encodeURIComponent(slug)}&month=${month}`).then((d) => d.entries),
  addEntry: (body) =>
    apiFetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((d) => d.entry),
  deleteEntry: (id, slug) =>
    apiFetch(`/api/entries/${encodeURIComponent(id)}?slug=${encodeURIComponent(slug)}`, { method: "DELETE" }),
  board: (month) => apiFetch(`/api/board?month=${month}`),
};

export default function App() {
  const [me, setMe] = useState(() => readIdentity());
  const [pickName, setPickName] = useState("");
  const [view, setView] = useState("log");
  const [status, setStatus] = useState(""); // aria-live announcements

  const [activity, setActivity] = useState("cardio");
  const [minutes, setMinutes] = useState("");
  const [date, setDate] = useState(TODAY);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [myEntries, setMyEntries] = useState([]);
  const [board, setBoard] = useState({ loading: false, error: "", rows: [], teams: null });
  const [confirmId, setConfirmId] = useState(null);

  const headingRef = useRef(null);

  useEffect(() => {
    document.title = "AF Conditioning Challenge";
  }, []);

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, [view, me]);

  async function refreshMine() {
    if (!me) return;
    try {
      setMyEntries(await api.myEntries(me.slug, MONTH_KEY));
    } catch {
      setStatus("Couldn't load your entries. Open My log again to retry.");
    }
  }

  useEffect(() => {
    refreshMine();
  }, [me]); // eslint-disable-line

  useEffect(() => {
    if (view === "board" && me) loadBoard();
    if (view === "mine" && me) refreshMine(); // stays fresh across devices
  }, [view]); // eslint-disable-line

  const myMonthTotal = () => myEntries.reduce((s, e) => s + safePts(e.pts), 0);

  function saveIdentity() {
    if (!pickName) {
      setStatus("Choose your name from the list first.");
      return;
    }
    const id = { name: pickName, slug: slugify(pickName), team: teamOf(pickName) };
    try {
      localStorage.setItem(ME_KEY, JSON.stringify({ name: pickName }));
    } catch {}
    setMe(id);
    setStatus(`Signed in as ${id.name}, Team ${id.team}.`);
  }

  function switchMember() {
    try {
      localStorage.removeItem(ME_KEY);
    } catch {}
    setMe(null);
    setPickName("");
    setMyEntries([]);
    setView("log");
  }

  async function logWorkout() {
    const act = ACTIVITIES.find((a) => a.id === activity);
    const m = Number(minutes);
    if (!m || m <= 0) {
      setFormErr("Enter your minutes first.");
      setStatus("Enter your minutes first.");
      return;
    }
    if (m > 1440) {
      setFormErr("That's more than 24 hours. Check the minutes.");
      setStatus("That's more than 24 hours. Check the minutes.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > TODAY) {
      setFormErr("Pick today or an earlier date.");
      setStatus("Pick today or an earlier date.");
      return;
    }
    setFormErr("");
    setSaving(true);
    try {
      const entry = await api.addEntry({ slug: me.slug, name: me.name, date, type: act.id, min: m });
      const entries = [...myEntries, entry].filter((e) => (e.date || "").startsWith(MONTH_KEY));
      setMyEntries(entries);
      const total = entries.reduce((s, e) => s + safePts(e.pts), 0);
      setStatus(
        `Logged: ${m} minutes ${act.label.toLowerCase()}, ${fmtPts(safePts(entry.pts))} points. Your ${MONTH_LABEL} total is ${fmtPts(total)} points for Team ${me.team}.`
      );
      setMinutes("");
    } catch {
      setStatus("That didn't save. Check your connection and try again.");
    }
    setSaving(false);
  }

  async function deleteEntry(id) {
    try {
      await api.deleteEntry(id, me.slug);
      const entries = myEntries.filter((e) => e.id !== id);
      setMyEntries(entries);
      const total = entries.reduce((s, e) => s + safePts(e.pts), 0);
      setStatus(`Entry deleted. Your ${MONTH_LABEL} total is ${fmtPts(total)} points.`);
    } catch {
      setStatus("Couldn't delete that entry. Try again.");
    }
    setConfirmId(null);
  }

  async function loadBoard() {
    setBoard((b) => ({ ...b, loading: true, error: "" }));
    try {
      const data = await api.board(MONTH_KEY);
      const rows = (data.rows || [])
        .filter((r) => r && ROSTER.includes(r.name)) // roster allowlist, defense in depth
        .map((r) => ({
          name: r.name,
          team: teamOf(r.name),
          pts: safePts(r.pts),
          days: Number(r.days) || 0,
        }));
      rows.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
      let prevPts = null, prevRank = 0;
      rows.forEach((row, i) => {
        row.rank = row.pts === prevPts ? prevRank : i + 1;
        prevPts = row.pts;
        prevRank = row.rank;
      });
      const mk = (team) => {
        const size = ROSTER.filter((n) => teamOf(n) === team).length;
        const tRows = rows.filter((r) => r.team === team);
        const pts = tRows.reduce((s, r) => s + r.pts, 0);
        return { size, reported: tRows.length, pts, avg: size ? pts / size : 0 };
      };
      const teams = { Blue: mk("Blue"), Red: mk("Red") };
      setBoard({ loading: false, error: "", rows, teams });
      setStatus(
        `Leaderboard updated. Blue ${fmtPts(teams.Blue.pts)} points, Red ${fmtPts(teams.Red.pts)} points, ${rows.length} of ${ROSTER.length} paddlers reported.`
      );
    } catch {
      setBoard({ loading: false, error: "Couldn't load the leaderboard. Check your connection.", rows: [], teams: null });
    }
  }

  // ---------- Derived, for render ----------
  const act = ACTIVITIES.find((a) => a.id === activity);
  const preview = pointsFor(minutes, act.rate);
  const mine = myEntries.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const blue = board.teams ? board.teams.Blue : null;
  const red = board.teams ? board.teams.Red : null;
  const totalPts = blue && red ? blue.pts + red.pts : 0;
  const blueShare = totalPts > 0 ? Math.max(10, Math.min(90, (blue.pts / totalPts) * 100)) : 50;
  const iReported = board.rows.some((r) => me && r.name === me.name);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    :root {
      --ink: #132C45; --mist: #F4F8F7; --card: #FFFFFF;
      --blue: #1A5FA0; --red: #AE352C; --slate: #46586A; --line: #C9D4D6;
    }
    html, body { margin: 0; padding: 0; background: var(--mist); }
    .afc { background: var(--mist); color: var(--ink); min-height: 100vh;
      font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; font-size: 17px; }
    .afc * { box-sizing: border-box; }
    .afc :focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; border-radius: 4px; }
    .wordmark { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; font-weight: 900;
      letter-spacing: 0.04em; text-transform: uppercase; line-height: 0.95; margin: 0; }
    .numeral { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; font-weight: 800;
      font-variant-numeric: tabular-nums; }
    .plexnum { font-variant-numeric: tabular-nums; }
    .card { background: var(--card); border: 2px solid var(--ink); border-radius: 10px; }
    .btn { border: 2px solid var(--ink); border-radius: 8px; font-weight: 600; min-height: 48px;
      background: #fff; color: var(--ink); cursor: pointer; font-size: 17px; }
    .btn:hover { background: #E9F0EF; }
    .btn-primary { background: var(--ink); color: #fff; }
    .btn-primary:hover { background: #0C1E30; }
    .btn[disabled] { opacity: 0.55; cursor: default; }
    .navbtn { border: 2px solid var(--ink); background: #fff; color: var(--ink); font-weight: 700;
      min-height: 48px; cursor: pointer; font-size: 16px; }
    .navbtn[aria-current="page"] { background: var(--ink); color: #fff; }
    .radio-card { display: flex; align-items: center; gap: 12px; border: 2px solid var(--ink);
      border-radius: 8px; padding: 12px 14px; background: #fff; cursor: pointer; }
    .radio-card:has(input:checked) { background: var(--ink); color: #fff; }
    .radio-card input { width: 22px; height: 22px; accent-color: var(--blue); flex: none; }
    .radio-card:has(input:checked) input { accent-color: #ffffff; }
    .field { border: 2px solid var(--ink); border-radius: 8px; min-height: 48px; padding: 8px 12px;
      font-size: 18px; background: #fff; color: var(--ink); width: 100%; }
    .field[aria-invalid="true"] { border-color: var(--red); }
    .err { color: var(--red); font-weight: 600; }
    .chip { border: 2px solid var(--ink); border-radius: 999px; background: #fff; min-height: 44px;
      min-width: 56px; font-weight: 600; cursor: pointer; font-size: 16px; }
    .chip:hover { background: #E9F0EF; }
    .lanewrap { border: 2px solid var(--ink); border-radius: 8px; overflow: hidden; height: 44px;
      display: flex; background: #fff; }
    .lane-blue { background: var(--blue); }
    .lane-red { background: var(--red); }
    .lane { transition: width 400ms ease; }
    @media (prefers-reduced-motion: reduce) { .lane { transition: none; } }
    .teamtag { font-weight: 700; }
    .teamtag.blue { color: var(--blue); }
    .teamtag.red { color: var(--red); }
    .tbl { width: 100%; border-collapse: collapse; }
    .tbl th, .tbl td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); }
    .tbl th { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--slate); }
    .tbl td.num, .tbl th.num { text-align: right; }
    .muted { color: var(--slate); }
    .rule-line { border-top: 2px solid var(--ink); }
    /* Utility classes (no framework needed) */
    .mx-auto{margin-left:auto;margin-right:auto}.max-w-md{max-width:28rem}
    .p-4{padding:16px}.px-4{padding-left:16px;padding-right:16px}.px-3{padding-left:12px;padding-right:12px}
    .pt-6{padding-top:24px}.pb-16{padding-bottom:64px}.pb-2{padding-bottom:8px}
    .mb-1{margin-bottom:4px}.mb-2{margin-bottom:8px}.mb-3{margin-bottom:12px}.mb-4{margin-bottom:16px}.mb-5{margin-bottom:20px}
    .mt-2{margin-top:8px}.mt-3{margin-top:12px}.mt-4{margin-top:16px}.my-4{margin-top:16px;margin-bottom:16px}
    .block{display:block}.w-full{width:100%}
    .grid{display:grid}.grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.gap-2{gap:8px}.gap-3{gap:12px}
    .flex{display:flex}.items-center{align-items:center}.justify-between{justify-content:space-between}.flex-wrap{flex-wrap:wrap}
    .font-semibold{font-weight:600}.rounded-lg{border-radius:8px}
    .overflow-x-auto{overflow-x:auto}.border-b{border-bottom-width:1px;border-bottom-style:solid}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  `;

  const h2Style = { fontSize: 26, marginBottom: 4, marginTop: 0 };

  return (
    <div className="afc" lang="en">
      <style>{css}</style>
      <div aria-live="polite" role="status" className="sr-only">{status}</div>

      <div className="mx-auto max-w-md px-4 pb-16 pt-6">
        <header className="mb-5">
          <h1 className="wordmark" style={{ fontSize: 34 }}>AF Conditioning</h1>
          <p className="muted" style={{ fontWeight: 600 }}>
            Dragon boat crew challenge · {MONTH_LABEL}
          </p>
        </header>

        <main>
        {!me ? (
          <section className="card p-4">
            <h2 ref={headingRef} tabIndex={-1} className="wordmark" style={h2Style}>Who's paddling?</h2>
            <p className="mb-4">
              Pick your name once. This device will remember you, and your workouts will
              count for your team.
            </p>
            <label htmlFor="who" className="block font-semibold mb-2">Your name</label>
            <select
              id="who"
              className="field mb-4"
              value={pickName}
              onChange={(e) => setPickName(e.target.value)}
            >
              <option value="">Choose your name…</option>
              <optgroup label="Team Blue (first names A to J)">
                {ROSTER.filter((n) => teamOf(n) === "Blue").map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </optgroup>
              <optgroup label="Team Red (first names K to Z)">
                {ROSTER.filter((n) => teamOf(n) === "Red").map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </optgroup>
            </select>
            <button type="button" className="btn btn-primary w-full" onClick={saveIdentity}>
              Save my name
            </button>
            <p className="muted mt-3" style={{ fontSize: 15 }}>
              Everything you log is visible to the whole team.
            </p>
          </section>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p style={{ margin: 0 }}>
                Logging as <strong>{me.name}</strong> ·{" "}
                <span className={`teamtag ${me.team.toLowerCase()}`}>Team {me.team}</span>
              </p>
              <button type="button" className="btn px-3" style={{ minHeight: 40 }} onClick={switchMember}>
                Not you?
              </button>
            </div>

            <nav aria-label="Sections" className="grid grid-cols-3 gap-2 mb-5">
              {[
                ["log", "Log"],
                ["board", "Leaderboard"],
                ["mine", "My log"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="navbtn rounded-lg"
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            {view === "log" && (
              <section className="card p-4">
                <h2 ref={headingRef} tabIndex={-1} className="wordmark" style={h2Style}>Log a workout</h2>
                <p className="muted mb-4" style={{ fontSize: 15 }}>
                  Cardio and strength: 1 point per 20 minutes. Stretching: 1 point per 10
                  minutes. Half points count.
                </p>

                <fieldset className="mb-4" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="font-semibold mb-2" style={{ padding: 0 }}>Activity</legend>
                  <div className="grid gap-2">
                    {ACTIVITIES.map((a) => (
                      <label key={a.id} className="radio-card">
                        <input
                          type="radio"
                          name="activity"
                          value={a.id}
                          checked={activity === a.id}
                          onChange={() => setActivity(a.id)}
                        />
                        <span>
                          <span className="font-semibold block">{a.label}</span>
                          <span style={{ fontSize: 15 }}>{a.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mb-1">
                  <label htmlFor="mins" className="block font-semibold mb-2">Minutes</label>
                  <input
                    id="mins"
                    className="field"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    value={minutes}
                    aria-invalid={formErr ? "true" : undefined}
                    aria-describedby={formErr ? "mins-err pts-preview" : "pts-preview"}
                    onChange={(e) => {
                      setMinutes(e.target.value);
                      if (formErr) setFormErr("");
                    }}
                  />
                  {formErr && (
                    <p id="mins-err" className="err mt-2">{formErr}</p>
                  )}
                </div>

                <div className="flex gap-2 mb-4 flex-wrap" role="group" aria-label="Quick minutes">
                  {[15, 30, 45, 60, 90].map((m) => (
                    <button key={m} type="button" className="chip px-3" onClick={() => { setMinutes(String(m)); setFormErr(""); }}>
                      {m}
                    </button>
                  ))}
                </div>

                <p id="pts-preview" className="mb-4">
                  <span className="numeral" style={{ fontSize: 44 }}>{fmtPts(preview)}</span>{" "}
                  <span className="font-semibold">points</span>
                  <span className="muted"> for {minutes || 0} min of {act.label.toLowerCase()}</span>
                </p>

                <label htmlFor="when" className="block font-semibold mb-2">Date</label>
                <input
                  id="when"
                  className="field mb-4"
                  type="date"
                  value={date}
                  max={TODAY}
                  onChange={(e) => setDate(e.target.value || TODAY)}
                />

                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={logWorkout}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Log workout"}
                </button>
                <p className="muted mt-3" style={{ fontSize: 15 }}>
                  Your {MONTH_LABEL} total so far:{" "}
                  <strong className="plexnum">{fmtPts(myMonthTotal())} points</strong>. Entries are
                  visible to the whole team.
                </p>
              </section>
            )}

            {view === "board" && (
              <section className="card p-4">
                <h2 ref={headingRef} tabIndex={-1} className="wordmark" style={h2Style}>Leaderboard</h2>
                <p className="muted mb-4" style={{ marginTop: 0 }}>{MONTH_LABEL}</p>

                {board.loading ? (
                  <p role="status">Loading team results…</p>
                ) : board.error ? (
                  <div>
                    <p className="err mb-3">{board.error}</p>
                    <button type="button" className="btn px-4" onClick={loadBoard}>Try again</button>
                  </div>
                ) : (
                  <>
                    {blue && red && (
                      <div className="mb-2">
                        <div className="lanewrap" aria-hidden="true">
                          <div className="lane lane-blue" style={{ width: `${blueShare}%` }} />
                          <div className="lane lane-red" style={{ width: `${100 - blueShare}%` }} />
                        </div>
                        <p className="mt-2" style={{ marginBottom: 0 }}>
                          <span className="teamtag blue">Blue {fmtPts(blue.pts)} pts</span>
                          {" · "}
                          <span className="teamtag red">Red {fmtPts(red.pts)} pts</span>
                        </p>
                        <p className="muted" style={{ fontSize: 15, marginTop: 4 }}>
                          Per paddler: Blue {blue.avg.toFixed(1)} · Red {red.avg.toFixed(1)}. Reported:
                          Blue {blue.reported} of {blue.size} · Red {red.reported} of {red.size}.
                        </p>
                      </div>
                    )}

                    <div className="rule-line my-4" />

                    {board.rows.length === 0 ? (
                      <p>
                        No workouts logged yet this month. Be the first: head to Log and
                        record one.
                      </p>
                    ) : (
                      <>
                        {!iReported && (
                          <p className="mb-3">You haven't logged this month yet.</p>
                        )}
                        <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Leaderboard table">
                        <table className="tbl">
                          <caption className="sr-only">
                            {MONTH_LABEL} leaderboard: rank, paddler, team, points, and days active
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col" className="num">#</th>
                              <th scope="col">Paddler</th>
                              <th scope="col">Team</th>
                              <th scope="col" className="num">Pts</th>
                              <th scope="col" className="num">Days</th>
                            </tr>
                          </thead>
                          <tbody>
                            {board.rows.map((r) => (
                              <tr key={r.name}>
                                <td className="num plexnum">{r.rank}</td>
                                <td>{r.name}{me && r.name === me.name ? " (you)" : ""}</td>
                                <td><span className={`teamtag ${r.team.toLowerCase()}`}>{r.team}</span></td>
                                <td className="num plexnum font-semibold">{fmtPts(r.pts)}</td>
                                <td className="num plexnum">{r.days}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                        <p className="muted mt-3" style={{ fontSize: 15 }}>
                          {ROSTER.length - board.rows.length} paddlers haven't logged yet in{" "}
                          {MONTH_LABEL.split(" ")[0]}.
                        </p>
                      </>
                    )}

                    <button type="button" className="btn px-4 mt-4" onClick={loadBoard}>
                      Refresh results
                    </button>
                  </>
                )}
              </section>
            )}

            {view === "mine" && (
              <section className="card p-4">
                <h2 ref={headingRef} tabIndex={-1} className="wordmark" style={h2Style}>My log</h2>
                <p className="mb-4">
                  {MONTH_LABEL}:{" "}
                  <strong className="plexnum">{fmtPts(myMonthTotal())} points</strong> across{" "}
                  {new Set(mine.map((e) => e.date)).size} days.
                </p>
                {mine.length === 0 ? (
                  <p>No workouts yet this month. Your first log takes about ten seconds.</p>
                ) : (
                  <ul role="list" className="grid gap-2" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {mine.map((e) => {
                      const a = ACTIVITIES.find((x) => x.id === e.type);
                      return (
                        <li key={e.id} className="flex items-center justify-between gap-3 border-b pb-2" style={{ borderColor: "var(--line)" }}>
                          <span>
                            <strong>{fmtDate(e.date)}</strong> · {a ? a.label : e.type} ·{" "}
                            {e.min} min · <span className="plexnum">{fmtPts(safePts(e.pts))} pts</span>
                          </span>
                          {confirmId === e.id ? (
                            <button
                              type="button"
                              className="btn px-3"
                              style={{ minHeight: 40, borderColor: "var(--red)", color: "var(--red)" }}
                              onClick={() => deleteEntry(e.id)}
                            >
                              Really delete?
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn px-3"
                              style={{ minHeight: 40 }}
                              onClick={() => { setConfirmId(e.id); setStatus("Press Really delete to confirm removing this entry."); }}
                              aria-label={`Delete entry: ${fmtDate(e.date)}, ${e.min} minutes`}
                            >
                              Delete
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}
