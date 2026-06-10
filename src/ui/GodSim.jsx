import React from "react";
import { boot, rebuild, VOWS } from "../engine";
import { narrate, setKey, getKey } from "../narrator/narrator";
import MapView, { faithColor } from "./MapView.jsx";
import Chronicle from "./Chronicle.jsx";
import { Bar, RegionPanel, PersonPanel, HousePanel, FaithPanel, ArtifactPanel, DeityPanel } from "./Panels.jsx";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
*{box-sizing:border-box}
.scriptorium{
  --ink:#0d0a06; --panel:#16110a; --line:#3a2f1c; --gold:#cba45a; --gold2:#e6c878;
  --parch:#ece0c6; --muted:#9c8d6e; --blood:#b24432; --sky:#7fb0c9;
  min-height:100vh; position:relative; color:var(--parch);
  font-family:'EB Garamond',Georgia,serif; font-size:16px; line-height:1.5;
  padding:22px clamp(14px,3vw,34px) 60px;
  background:
    radial-gradient(900px 500px at 78% -8%, rgba(201,162,75,.16), transparent 60%),
    radial-gradient(700px 600px at 10% 110%, rgba(127,176,201,.07), transparent 60%),
    linear-gradient(180deg,#100b06,#0a0704);
}
.grain{position:fixed;inset:0;pointer-events:none;opacity:.5;z-index:0;
  background-image:radial-gradient(rgba(255,240,200,.025) 1px,transparent 1px);
  background-size:3px 3px;}
.scriptorium>*{position:relative;z-index:1}
h1{font-family:'Cinzel',serif;font-weight:700;font-size:clamp(22px,3.4vw,34px);
  letter-spacing:.14em;margin:0;color:var(--gold2);text-shadow:0 2px 18px rgba(201,162,75,.25)}
.sub{color:var(--muted);font-size:15px;letter-spacing:.06em;margin-top:4px;font-variant:small-caps}
.empire{color:var(--blood)}
.topbar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;
  border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:18px}
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.btn{font-family:'Cinzel',serif;font-size:12px;letter-spacing:.1em;cursor:pointer;
  background:transparent;color:var(--parch);border:1px solid var(--line);
  padding:9px 13px;border-radius:2px;transition:.18s;white-space:nowrap}
.btn:hover{border-color:var(--gold);color:var(--gold2);box-shadow:0 0 14px rgba(201,162,75,.18)}
.btn:disabled{opacity:.4;cursor:default;box-shadow:none}
.btn.gold{background:linear-gradient(180deg,#d8b65f,#a9842f);color:#1a1206;border-color:#e6c878;font-weight:600}
.btn.gold:hover{filter:brightness(1.08)}
.btn.hand{border-color:#5a7d8c;color:#cfe3ec}
.btn.hand:hover{border-color:var(--sky);color:#eaf5fb;box-shadow:0 0 14px rgba(127,176,201,.25)}
.btn.blood{border-color:#7a3a2e;color:#e8b8aa}
.btn.blood:hover{border-color:var(--blood);color:#ffd9cc;box-shadow:0 0 14px rgba(178,68,50,.25)}
.btn.on{border-color:var(--gold);color:var(--gold2)}
.btn.ghost{opacity:.78}
.seed{width:90px;background:#0c0904;border:1px solid var(--line);color:var(--muted);
  padding:8px;border-radius:2px;font-family:'Cinzel';font-size:12px}
.grid{display:grid;grid-template-columns:minmax(430px,1fr) 1.05fr;gap:18px}
@media(max-width:980px){.grid{grid-template-columns:1fr}}
.realm{display:flex;flex-direction:column;gap:14px;min-width:0}
.card{background:linear-gradient(180deg,rgba(28,21,11,.9),rgba(16,11,6,.9));
  border:1px solid var(--line);border-radius:3px;padding:14px 16px;
  box-shadow:inset 0 1px 0 rgba(230,200,120,.06)}
.card h2,.chronh{font-family:'Cinzel',serif;font-size:12px;font-weight:600;letter-spacing:.18em;
  text-transform:uppercase;color:var(--gold);margin:0 0 10px;display:flex;align-items:center;gap:8px}
.big{font-size:19px;color:var(--parch)}.big.lost{color:var(--muted);font-style:italic}
.of{color:var(--muted);font-size:13px;text-transform:none;letter-spacing:0}
.lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:9px 0 4px}
.faithline{color:var(--muted);margin-top:8px;font-style:italic;font-size:14px}
.bar{height:6px;background:#0b0803;border:1px solid #2a2113;border-radius:3px;overflow:hidden}
.barfill{display:block;height:100%}
.barfill.gold{background:linear-gradient(90deg,#8a6a28,#e6c878)}
.barfill.blood{background:linear-gradient(90deg,#5e1f17,#b24432)}
.barfill.sky{background:linear-gradient(90deg,#2f5a6b,#7fb0c9)}
.map{width:100%;height:auto;display:block;background:#0d0a05;border:1px solid var(--line);border-radius:3px}
.overlaybar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.overlaybar .btn{padding:5px 9px;font-size:10.5px}
.tabbar{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:10px;padding-bottom:8px}
.tabbtn{font-family:'Cinzel',serif;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;
  background:transparent;border:none;color:var(--muted);padding:4px 8px;border-bottom:2px solid transparent}
.tabbtn.on{color:var(--gold2);border-bottom-color:var(--gold)}
.house,.faith{padding:7px 0;border-top:1px solid rgba(58,47,28,.5)}
.house:first-of-type{border-top:none}
.house{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}
.house:hover .hn{color:var(--gold2)}
.house.dead{opacity:.4}
.faith{cursor:pointer}.faith:hover .fn{color:var(--gold2)}
.scrollist{max-height:300px;overflow-y:auto;margin-top:2px;padding-right:4px}
.scrollist::-webkit-scrollbar{width:7px}.scrollist::-webkit-scrollbar-thumb{background:rgba(201,162,75,.3);border-radius:4px}
.hn{font-size:16px}.hmeta{color:var(--muted);font-size:13px;text-align:right}
.fn{font-size:16px}.fmeta{color:var(--muted);font-size:13px;margin:2px 0 5px;font-style:italic}
.chip{display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid rgba(0,0,0,.4)}
.statgrid{display:flex;flex-wrap:wrap;gap:5px 14px;margin:7px 0}
.stat{font-size:12.5px;color:var(--parch);letter-spacing:.02em}
.stat b{font-family:'Cinzel',serif;font-weight:600;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-right:5px}
.stat.emp b{color:var(--blood)}
.inspector{border-color:var(--gold)}
.desire{font-style:italic;color:#e7d6ab;font-size:15px}
.desire.broken{color:var(--blood)}
.woundline{color:#d79a86;font-size:13.5px;font-style:italic;margin-top:3px}
.driverow{display:grid;grid-template-columns:86px 1fr;gap:8px;align-items:center;margin:2px 0}
.dlabel{font-size:11.5px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
.bondrow{font-size:13.5px;color:#cdbd97;padding:2px 0}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.picklist{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;max-height:200px;overflow:auto;margin-top:8px}
.soul{text-align:left;background:#0e0a05;border:1px solid var(--line);border-radius:2px;
  padding:7px 10px;cursor:pointer;color:var(--parch);transition:.15s}
.soul:hover{border-color:var(--gold);background:#171005}
.soul.chosenrow{border-color:var(--sky)}
.sname{display:block;font-size:14.5px}
.smeta{display:block;font-size:12px;color:var(--muted)}
.souls{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:6px;max-height:260px;overflow:auto}
.linklike{background:none;border:none;color:var(--sky);cursor:pointer;font-family:inherit;font-size:13px;
  text-decoration:underline dotted;padding:0 6px 0 0}
.linklike:hover{color:#eaf5fb}
.linklike.fold{display:block;margin:4px 0;color:var(--muted);font-style:italic}
.x{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px}
.chroniclewrap{display:flex;flex-direction:column;min-height:0}
.chronicle{background:linear-gradient(180deg,rgba(14,10,5,.6),rgba(10,7,4,.6));
  border:1px solid var(--line);border-radius:3px;padding:6px 16px;
  height:72vh;overflow:auto}
.line{margin:0;padding:6px 0;border-bottom:1px solid rgba(58,47,28,.35);font-size:15px;color:#d8c9a6}
.line:last-child{border-bottom:none}
.line.small{font-size:13.5px;color:#b3a584;border:none;padding:2px 0}
.line.major{font-size:16.5px;color:#efe2bd}
.line.war{color:#d79a86}
.line.divine{color:#cfe7f1;border-left:2px solid var(--sky);padding-left:10px;
  background:linear-gradient(90deg,rgba(127,176,201,.08),transparent);font-style:italic}
.whychip{color:var(--sky);font-size:12px;font-style:italic}
.causebox{background:rgba(127,176,201,.05);border-left:2px solid rgba(127,176,201,.35);
  padding:6px 10px;margin:2px 0 6px}
.muted{color:var(--muted);font-style:italic}
.small{font-size:13px}
.chronicle::-webkit-scrollbar,.souls::-webkit-scrollbar,.picklist::-webkit-scrollbar{width:8px}
.chronicle::-webkit-scrollbar-thumb,.souls::-webkit-scrollbar-thumb,.picklist::-webkit-scrollbar-thumb{background:#3a2f1c;border-radius:4px}
.erablock{padding:9px 0;border-bottom:1px solid rgba(58,47,28,.35)}
.erablock:last-child{border-bottom:none}
.erahead{font-family:'Cinzel',serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);opacity:.78;margin-bottom:6px}
.prose{margin:0;font-size:16.5px;line-height:1.62;color:#ecdcb6}
.scribing{margin:0 0 6px;color:var(--sky);font-style:italic;opacity:.85;font-size:14px}
.aibadge{font-family:'EB Garamond',serif;font-style:italic;text-transform:none;letter-spacing:0;color:var(--sky);font-size:12px;margin-left:8px;opacity:.85}
.facts{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:9px;padding-top:8px;border-top:1px dotted rgba(201,162,75,.22)}
.setupveil{position:fixed;inset:0;background:rgba(8,5,2,.88);z-index:40;display:flex;align-items:center;justify-content:center;padding:20px}
.setup{max-width:680px;width:100%;background:linear-gradient(180deg,#1a1309,#0f0a05);border:1px solid var(--gold);
  border-radius:4px;padding:26px 30px;box-shadow:0 0 60px rgba(201,162,75,.15);max-height:92vh;overflow:auto}
.setup h1{font-size:24px;margin-bottom:4px}
.advrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:8px}
.advcard{background:#0e0a05;border:1px solid var(--line);border-radius:3px;padding:10px 12px;cursor:pointer;text-align:left;color:var(--parch)}
.advcard:hover{border-color:var(--gold)}
.advcard.on{border-color:var(--gold2);box-shadow:0 0 14px rgba(201,162,75,.2)}
.advname{font-family:'Cinzel',serif;font-size:12.5px;letter-spacing:.1em;color:var(--gold2);display:block;margin-bottom:3px}
.advdesc{font-size:12.5px;color:var(--muted)}
`;

const ADVERSARIES = [
  { key: "none", name: "An empty sky", desc: "No rival. The world is yours alone to tend or torment." },
  { key: "rival-deity", name: "A rival deity", desc: "Something else whispers in the dark — cursing lands, raising champions, corrupting faiths, tempting your Chosen." },
  { key: "god-slayer", name: "A mortal god-slayer", desc: "One mortal swears to climb to heaven, gathering your relics one by one to sunder your voice from the world." },
];

const CAP = 40;

export default function GodSim() {
  const engineRef = React.useRef(null);
  const [v, setV] = React.useState(null);
  const [seed, setSeed] = React.useState(2026);
  const [opts, setOpts] = React.useState({ adversary: "none", vow: "none" });
  const [setup, setSetup] = React.useState(true);
  const [sel, setSel] = React.useState(null);          // {type:'region'|'person'|'house'|'faith'|'artifact'|'deity', id}
  const [tab, setTab] = React.useState("realm");
  const [overlay, setOverlay] = React.useState("realms");
  const [hand, setHand] = React.useState(false);
  const [auto, setAuto] = React.useState(false);
  const [useAI, setUseAI] = React.useState(false);
  const [narr, setNarr] = React.useState({});
  const [stats, setStats] = React.useState({});
  const logRef = React.useRef(null);
  const autoRef = React.useRef(false);
  const busyRef = React.useRef(false);
  const aiRef = React.useRef(false);
  const bootRef = React.useRef({ seed: 2026, opts: { adversary: "none", vow: "none" } }); // the authoritative boot params — rewind replays against THESE
  const genRef = React.useRef(0);      // timeline generation: bump on begin/rewind so stale narrations are discarded
  const loopRef = React.useRef(0);     // auto-run loop token: bump to cancel a running loop
  const [stepping, setStepping] = React.useState(false);
  React.useEffect(() => { aiRef.current = useAI; }, [useAI]);

  const sync = () => setV(engineRef.current.view());
  const begin = (s, o) => {
    bootRef.current = { seed: s, opts: { adversary: o.adversary, vow: o.vow } };
    genRef.current++;
    engineRef.current = boot(s, { adversary: o.adversary, vow: o.vow });
    setSel(null); setHand(false); setAuto(false); setNarr({}); setStats({}); setSetup(false); setTab("realm");
    sync();
  };
  React.useEffect(() => {
    bootRef.current = { seed, opts: { adversary: "none", vow: "none" } };
    engineRef.current = boot(seed, {});
    sync();
    /* eslint-disable-next-line */
  }, []);

  const snapshot = (vv) => ({
    ...vv.stats,
    crown: vv.crown ? { house: vv.crown.house, legitimacy: vv.crown.legitimacy } : null,
    faiths: vv.faiths.length, grace: vv.grace, empire: vv.empire, mood: vv.mood,
  });

  const ctxOf = (vv) =>
    `${vv.crown ? `The realm is ruled by ${vv.crown.monarch || "a regent"} of House ${vv.crown.house}` : "The realm has no sovereign"}.` +
    `${vv.empire ? ` The ${vv.empire} Empire looms over all.` : ""}` +
    `${vv.chosen && vv.chosen.alive ? ` ${vv.chosen.name} bears the god's charge.` : ""}` +
    ` The age is ${vv.mood}.`;

  async function step() {
    if (busyRef.current) return;
    busyRef.current = true; setStepping(true);
    try {
      const v0 = engineRef.current.view();
      if (v0.era >= CAP) { setAuto(false); return; }
      const before = v0.events.length;
      engineRef.current.advance();
      const vv = engineRef.current.view();
      setV(vv);
      setStats((prev) => ({ ...prev, [vv.era]: snapshot(vv) }));
      if (aiRef.current) {
        const era = vv.era;
        const gen = genRef.current; // discard narration if the timeline changed underneath it
        const lines = vv.events.slice(before).filter((e) => e.importance >= 2).map((e) => e.text);
        if (lines.length) {
          setNarr((n) => ({ ...n, [era]: { status: "loading" } }));
          try {
            const prose = await narrate(era, lines, ctxOf(vv));
            if (!prose) throw new Error("no key");
            if (genRef.current === gen) setNarr((n) => ({ ...n, [era]: { status: "done", prose } }));
          } catch { if (genRef.current === gen) setNarr((n) => ({ ...n, [era]: { status: "error" } })); }
        }
      }
    } finally { busyRef.current = false; setStepping(false); }
  }

  React.useEffect(() => {
    autoRef.current = auto;
    const loopId = ++loopRef.current; // any previous loop sees a stale token and exits
    if (auto) (async () => {
      while (autoRef.current && loopRef.current === loopId) {
        if (engineRef.current.view().era >= CAP) { setAuto(false); break; }
        await step();
        await new Promise((r) => setTimeout(r, aiRef.current ? 400 : 900));
      }
    })();
    /* eslint-disable-next-line */
  }, [auto]);
  React.useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [v && v.events.length, narr]);

  const souls = React.useMemo(() => (v ? engineRef.current.listLiving() : []), [v]);

  if (!v) return null;

  const act = (fn) => { fn(engineRef.current); sync(); };
  const rewind = (target) => {
    // replay against the engine's OWN boot params — never the (possibly edited) setup form
    const { seed: bootSeed, opts: bootOpts } = bootRef.current;
    const journal = engineRef.current.journal();
    genRef.current++;
    engineRef.current = rebuild(bootSeed, bootOpts, journal, target);
    setNarr((n) => Object.fromEntries(Object.entries(n).filter(([e]) => +e <= target)));
    setStats((s) => Object.fromEntries(Object.entries(s).filter(([e]) => +e <= target)));
    setSel(null); sync();
  };
  const selectPerson = (id) => { setSel({ type: "person", id }); };
  const focusGlyph = { relic: "the relic", line: "the line", god: "the god", reforged: "a new relic", salvation: "deliverance", ancestor: "the dead", doom: "the closing sky" };

  return (
    <div className="scriptorium">
      <style>{CSS}</style>
      <div className="grain" />

      {setup && (
        <div className="setupveil">
          <div className="setup">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h1>Chronicle of the Realm</h1>
              {v.era > 0 && <button className="x" onClick={() => setSetup(false)}>✕</button>}
            </div>
            <div className="sub">a deterministic god-simulation — the same seed always tells the same story</div>
            <div className="lbl" style={{ marginTop: 18 }}>The seed of the world</div>
            <input className="seed" type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 0)} />
            <div className="lbl" style={{ marginTop: 14 }}>The adversary</div>
            <div className="advrow">
              {ADVERSARIES.map((a) => (
                <button key={a.key} className={"advcard" + (opts.adversary === a.key ? " on" : "")}
                  onClick={() => setOpts((o) => ({ ...o, adversary: a.key }))}>
                  <span className="advname">{a.name}</span>
                  <span className="advdesc">{a.desc}</span>
                </button>
              ))}
            </div>
            <div className="lbl" style={{ marginTop: 14 }}>The vow — a law you write for yourself, and may break</div>
            <div className="advrow">
              <button className={"advcard" + (opts.vow === "none" ? " on" : "")} onClick={() => setOpts((o) => ({ ...o, vow: "none" }))}>
                <span className="advname">No vow</span><span className="advdesc">An unbound god.</span>
              </button>
              {Object.entries(VOWS).filter(([k]) => k !== "none").map(([k, def]) => (
                <button key={k} className={"advcard" + (opts.vow === k ? " on" : "")} onClick={() => setOpts((o) => ({ ...o, vow: k }))}>
                  <span className="advname">{k}</span><span className="advdesc">{def.text}</span>
                </button>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 18 }}>
              <button className="btn gold" onClick={() => begin(seed, opts)}>Let there be a world ▸</button>
            </div>
          </div>
        </div>
      )}

      <header className="topbar">
        <div>
          <h1>Chronicle of the Realm</h1>
          <div className="sub">
            {v.era === 0 ? "Before the first age" : `Era ${v.era} · ${v.year} AE · ${v.mood}`}
            {v.empire && <span className="empire"> · the {v.empire} Empire ascendant</span>}
            {v.deity.vow?.broken && <span className="empire"> · the vow lies broken</span>}
          </div>
        </div>
        <div className="controls">
          <button className="btn gold" onClick={() => step()} disabled={v.era >= CAP || auto || stepping}>{v.era >= CAP ? "The age has closed" : stepping ? "The quill moves…" : "Advance the Age ▸"}</button>
          <button className={"btn " + (auto ? "on" : "")} onClick={() => setAuto((a) => !a)} disabled={v.era >= CAP}>{auto ? "❚❚ Pause" : "▷ Auto"}</button>
          <button className={"btn hand " + (hand ? "on" : "")} onClick={() => setHand((h) => !h)}>✶ Divine Hand · {hand ? "open" : "stayed"}</button>
          <button className={"btn " + (useAI ? "on" : "")} onClick={() => setUseAI((x) => !x)} title="AI chronicler">✦ Narrator · {useAI ? "on" : "off"}</button>
          <button className="btn ghost" onClick={() => { const k = window.prompt("Anthropic API key — stored only in this browser (localStorage), used for narration. Leave blank to clear.", getKey() || ""); if (k !== null) setKey(k); }} title="Set your Anthropic API key (needed for the Narrator on the hosted site)">🔑 Key{getKey() ? " ✓" : ""}</button>
          <button className="btn ghost" onClick={() => setSetup(true)}>↻ New Realm</button>
        </div>
      </header>

      <div className="grid">
        <section className="realm">
          <div className="card">
            <h2>The Land {hand && <span className="of">— the Hand is open: touch a region, a soul, a house…</span>}</h2>
            <MapView regions={v.regions} faiths={v.faiths} overlay={overlay}
              selectedId={sel?.type === "region" ? sel.id : null}
              onSelect={(id) => setSel({ type: "region", id })} />
            <div className="overlaybar">
              {["realms", "terrain", "faith", "prosperity", "culture"].map((o) => (
                <button key={o} className={"btn " + (overlay === o ? "on" : "ghost")} onClick={() => setOverlay(o)}>{o}</button>
              ))}
            </div>
          </div>

          {sel?.type === "region" && <RegionPanel region={v.regions.find((r) => r.id === sel.id)} v={v} hand={hand} act={act} />}
          {sel?.type === "person" && <PersonPanel pid={sel.id} v={v} souls={souls} engine={engineRef.current} hand={hand} act={act} onSelectPerson={selectPerson} />}
          {sel?.type === "house" && <HousePanel houseId={sel.id} v={v} hand={hand} act={act} onSelectRegion={(id) => setSel({ type: "region", id })} />}
          {sel?.type === "faith" && <FaithPanel faithName={sel.id} v={v} hand={hand} act={act} />}
          {sel?.type === "artifact" && <ArtifactPanel artifactId={sel.id} v={v} souls={souls} hand={hand} act={act} />}
          {sel && <button className="x" onClick={() => setSel(null)} style={{ alignSelf: "flex-end", marginTop: -8 }}>✕ close</button>}

          <div className="card">
            <div className="tabbar">
              {["realm", "houses", "faiths", "relics", "souls", "god"].map((t) => (
                <button key={t} className={"tabbtn" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>

            {tab === "realm" && (<>
              {v.crown ? (<>
                <div className="big">{v.crown.monarch || "—"} <span className="of">of House {v.crown.house}</span>
                  {v.crown.monarchId && <button className="linklike" onClick={() => selectPerson(v.crown.monarchId)}>inspect</button>}
                </div>
                <div className="lbl">Legitimacy</div><Bar v={v.crown.legitimacy} tone={v.crown.legitimacy < 0.4 ? "blood" : "gold"} />
                <div className="faithline">{v.crown.stateFaith ? "Sanctified by " + v.crown.stateFaith : "No faith sanctifies the throne"}</div>
              </>) : <div className="muted">No sovereign. The realm lies in interregnum.</div>}
              {v.wars.length > 0 && (<>
                <div className="lbl">Wars now burning</div>
                {v.wars.map((x) => (
                  <div key={x.id} className="bondrow">⚔ House {x.attacker} against House {x.defender} — {x.aim} <span className="of">(since era {x.since})</span></div>
                ))}
              </>)}
              {v.prophecies.filter((p) => p.status === "open").length > 0 && (<>
                <div className="lbl">Words hanging over the world</div>
                {v.prophecies.filter((p) => p.status === "open").map((p) => (
                  <div key={`${p.era}:${p.text}`} className="bondrow">“{p.text}” <span className="of">({p.origin}, era {p.era}{p.subject ? ` — eyes on ${p.subject}` : ""})</span></div>
                ))}
              </>)}
              {v.chosen && (
                <div className="faithline">
                  ✦ The Chosen: {v.chosen.name} of House {v.chosen.house} — {v.chosen.outcome === "fulfilled" ? "the prophecy is fulfilled." : v.chosen.outcome === "broken" ? "the prophecy lies broken." : v.chosen.outcome === "turned" ? "turned from the charge." : v.chosen.alive ? "bearing the god's charge." : "fallen."}
                  {v.chosen.personId && <button className="linklike" onClick={() => selectPerson(v.chosen.personId)}>inspect</button>}
                </div>
              )}
              <div className="lbl">Grace upon the land</div><Bar v={v.grace} max={1.5} tone="sky" />
              <div className="lbl">The learned arts</div>
              {v.cultures.map((c) => (
                <div key={c.key} className="bondrow"><b>{c.key}</b> — {c.tech.length ? c.tech.join(", ") : "no arts yet"} <span className="of">· prizes {Object.entries(c.values).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join(" & ")}</span></div>
              ))}
            </>)}

            {tab === "houses" && (
              <div className="scrollist">
                {[...v.houses].sort((a, b) => (b.living - a.living) || (b.holdings - a.holdings)).map((h) => (
                  <div key={h.id} className={"house" + (h.living ? "" : " dead")} onClick={() => setSel({ type: "house", id: h.id })}>
                    <span className="hn"><span className="chip" style={{ background: h.color }} /> {h.name}{v.empire === h.name ? " ♛" : ""}</span>
                    <span className="hmeta">{h.living ? `${h.lord || "—"} · ${h.living} souls · ${h.holdings} domain${h.holdings === 1 ? "" : "s"}${h.overlord ? ` · vassal of ${h.overlord}` : ""}` : "extinct"}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "faiths" && (<>
              {v.faiths.length ? v.faiths.map((f) => (
                <div key={f.id} className="faith" onClick={() => setSel({ type: "faith", id: f.name })}>
                  <div className="fn"><span className="chip" style={{ background: faithColor(f.name, v.faiths) }} /> {f.name}</div>
                  <div className="fmeta">venerates {focusGlyph[f.focus] ?? f.focus} · {f.posture} · {f.regions} regions · creed: {f.creed}{f.mem < 0.2 ? " · the god forgotten" : ""}</div>
                  <Bar v={f.vitality} tone="gold" />
                </div>
              )) : <div className="muted">No faith has yet stirred.</div>}
            </>)}

            {tab === "relics" && (<>
              {v.artifacts.map((a) => (
                <div key={a.id} className="faith" onClick={() => setSel({ type: "artifact", id: a.id })}>
                  <div className="fn">{a.name}</div>
                  <div className="fmeta">{a.state === "held" ? `borne by ${a.holder}` : a.state}{a.state === "lost" && a.lostIn ? ` in ${a.lostIn}` : ""} · {a.power} · legend {a.legend}</div>
                  <Bar v={a.legend} max={30} />
                </div>
              ))}
            </>)}

            {tab === "souls" && (
              <div className="souls">
                {souls.slice(0, 80).map((p) => (
                  <button key={p.id} className={"soul" + (p.chosen ? " chosenrow" : "")} onClick={() => selectPerson(p.id)}>
                    <span className="sname">{p.name}{p.artifacts?.length ? " ⚔" : ""}{p.chosen ? " ✦" : ""}{p.avatar ? " ☀" : ""}{p.isMonarch ? " ♛" : ""}</span>
                    <span className="smeta">{p.house} · {p.age}y · renown {p.renown}</span>
                  </button>
                ))}
              </div>
            )}

            {tab === "god" && <DeityPanel v={v} vows={VOWS} hand={hand} act={act} onRewind={rewind} era={v.era} />}
          </div>
        </section>

        <section className="chroniclewrap">
          <h2 className="chronh">The Chronicle{useAI && <span className="aibadge">· illuminated by the chronicler</span>}</h2>
          <Chronicle v={v} narr={narr} stats={stats} logRef={logRef}
            nameOf={(id) => engineRef.current.inspect(id)?.name ?? id}
            onJumpActor={(id) => selectPerson(id)} />
        </section>
      </div>
    </div>);
}
