import React from "react";
import { boot } from "../engine";
import { narrate, setKey, getKey } from "../narrator/narrator";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');
*{box-sizing:border-box}
.scriptorium{
  --ink:#0d0a06; --panel:#16110a; --line:#3a2f1c; --gold:#cBA45a; --gold2:#e6c878;
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
.btn.gold{background:linear-gradient(180deg,#caa css,#b08a3e);background:linear-gradient(180deg,#d8b65f,#a9842f);color:#1a1206;border-color:#e6c878;font-weight:600}
.btn.gold:hover{filter:brightness(1.08)}
.btn.hand{border-color:#5a7d8c;color:#cfe3ec}
.btn.hand:hover{border-color:var(--sky);color:#eaf5fb;box-shadow:0 0 14px rgba(127,176,201,.25)}
.btn.on{border-color:var(--gold);color:var(--gold2)}
.btn.ghost{opacity:.78}
.seed{width:74px;background:#0c0904;border:1px solid var(--line);color:var(--muted);
  padding:8px;border-radius:2px;font-family:'Cinzel';font-size:12px}
.handpanel{border:1px solid var(--gold);background:linear-gradient(180deg,#171107,#100b06);
  border-radius:3px;padding:14px;margin-bottom:18px;box-shadow:0 0 40px rgba(201,162,75,.1)}
.handhead{display:flex;justify-content:space-between;align-items:center;gap:10px;
  font-variant:small-caps;letter-spacing:.05em;color:var(--gold2);margin-bottom:10px}
.x{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px}
.souls{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px;max-height:240px;overflow:auto}
.soul{text-align:left;background:#0e0a05;border:1px solid var(--line);border-radius:2px;
  padding:7px 10px;cursor:pointer;color:var(--parch);transition:.15s}
.soul:hover{border-color:var(--gold);background:#171005}
.soul.chosenrow{border-color:var(--sky)}
.sname{display:block;font-size:15px}
.smeta{display:block;font-size:12px;color:var(--muted)}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.reclaim{margin-top:10px}
.grid{display:grid;grid-template-columns:1fr 1.05fr;gap:18px}
@media(max-width:840px){.grid{grid-template-columns:1fr}}
.realm{display:flex;flex-direction:column;gap:14px}
.card{background:linear-gradient(180deg,rgba(28,21,11,.9),rgba(16,11,6,.9));
  border:1px solid var(--line);border-radius:3px;padding:14px 16px;
  box-shadow:inset 0 1px 0 rgba(230,200,120,.06)}
.card h2,.chronh{font-family:'Cinzel',serif;font-size:12px;font-weight:600;letter-spacing:.18em;
  text-transform:uppercase;color:var(--gold);margin:0 0 10px}
.big{font-size:19px;color:var(--parch)}.big.lost{color:var(--muted);font-style:italic}
.of{color:var(--muted);font-size:15px}
.lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:9px 0 4px}
.lbl.grace{margin-top:12px}
.faithline{color:var(--muted);margin-top:8px;font-style:italic;font-size:14px}
.bar{height:6px;background:#0b0803;border:1px solid #2a2113;border-radius:3px;overflow:hidden}
.barfill{display:block;height:100%}
.barfill.gold{background:linear-gradient(90deg,#8a6a28,#e6c878)}
.barfill.blood{background:linear-gradient(90deg,#5e1f17,#b24432)}
.barfill.sky{background:linear-gradient(90deg,#2f5a6b,#7fb0c9)}
.house,.faith{padding:7px 0;border-top:1px solid rgba(58,47,28,.5)}
.house:first-of-type{border-top:none}
.house{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.house.dead{opacity:.4}
.scrollist{max-height:300px;overflow-y:auto;margin-top:2px;padding-right:4px}
.scrollist::-webkit-scrollbar{width:7px}.scrollist::-webkit-scrollbar-thumb{background:rgba(201,162,75,.3);border-radius:4px}
.hn{font-size:16px}.hmeta{color:var(--muted);font-size:13px;text-align:right}
.fn{font-size:16px}.fmeta{color:var(--muted);font-size:13px;margin:2px 0 5px;font-style:italic}
.chosencard{border-color:#5a7d8c}
.chosencard.fulfilled{border-color:var(--gold2);box-shadow:0 0 26px rgba(201,162,75,.18)}
.chosencard.broken{border-color:var(--blood)}
.chroniclewrap{display:flex;flex-direction:column;min-height:0}
.chronicle{background:linear-gradient(180deg,rgba(14,10,5,.6),rgba(10,7,4,.6));
  border:1px solid var(--line);border-radius:3px;padding:6px 16px;
  height:560px;max-height:62vh;overflow:auto}
.line{margin:0;padding:7px 0;border-bottom:1px solid rgba(58,47,28,.35);font-size:15.5px;color:#d8c9a6}
.line:last-child{border-bottom:none}
.line.war{color:#d79a86}
.line.divine{color:#cfe7f1;border-left:2px solid var(--sky);padding-left:10px;
  background:linear-gradient(90deg,rgba(127,176,201,.08),transparent);font-style:italic}
.muted{color:var(--muted);font-style:italic}
.chronicle::-webkit-scrollbar,.souls::-webkit-scrollbar{width:8px}
.chronicle::-webkit-scrollbar-thumb,.souls::-webkit-scrollbar-thumb{background:#3a2f1c;border-radius:4px}
.erablock{padding:9px 0;border-bottom:1px solid rgba(58,47,28,.35)}
.erablock:last-child{border-bottom:none}
.erahead{font-family:'Cinzel',serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);opacity:.78;margin-bottom:6px}
.prose{margin:0;font-size:16.5px;line-height:1.62;color:#ecdcb6}
.scribing{margin:0 0 6px;color:var(--sky);font-style:italic;opacity:.85;font-size:14px}
.aibadge{font-family:'EB Garamond',serif;font-style:italic;text-transform:none;letter-spacing:0;color:var(--sky);font-size:12px;margin-left:8px;opacity:.85}
.facts{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:9px;padding-top:8px;border-top:1px dotted rgba(201,162,75,.22)}
.stat{font-size:12.5px;color:var(--parch);letter-spacing:.02em}
.stat b{font-family:'Cinzel',serif;font-weight:600;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-right:5px}
.stat.emp b{color:var(--blood)}
.facthouses{margin-top:6px;font-size:12.5px;color:var(--muted);font-style:italic}
`;


function Bar({v, max=1, tone="gold"}){
  const pct = Math.max(0, Math.min(100, (v/max)*100));
  return (<div className="bar"><span className={"barfill "+tone} style={{width: pct+"%"}}/></div>);
}

export default function GodSim(){
  const engineRef = React.useRef(null);
  const [v, setV] = React.useState(null);
  const [seed, setSeed] = React.useState(2026);
  const [sel, setSel] = React.useState(null);
  const [hand, setHand] = React.useState(false);
  const [auto, setAuto] = React.useState(false);
  const [useAI, setUseAI] = React.useState(false);
  const [narr, setNarr] = React.useState({});
  const [stats, setStats] = React.useState({});
  const logRef = React.useRef(null);
  const autoRef = React.useRef(false);
  const busyRef = React.useRef(false);
  const aiRef = React.useRef(false);
  const CAP = 28;

  const sync = () => setV(engineRef.current.view());
  const fresh = (s) => { engineRef.current = boot(s); setSel(null); setHand(false); setAuto(false); setNarr({}); setStats({}); sync(); };
  React.useEffect(()=>{ engineRef.current = boot(seed); sync(); /* eslint-disable-next-line */ }, []);
  React.useEffect(()=>{ aiRef.current = useAI; }, [useAI]);

  // a short rolling context so the chronicler keeps continuity across eras
  const ctxOf = (vv)=> `${vv.crown?`The realm is ruled by ${vv.crown.monarch||"a regent"} of House ${vv.crown.house}`:"The realm has no sovereign"}.${vv.empire?` The ${vv.empire} Empire looms over all.`:""}${vv.chosen&&vv.chosen.alive?` ${vv.chosen.name} bears the god's charge.`:""}`;

  // the AI narrator — one batched call per era; keyless inside a Claude.ai artifact
  async function narrateEra(era, lines, context){
    const p = await narrate(era, lines, context);
    if(!p) throw new Error("narrator unavailable (no API key set)");
    return p;
  }

  async function step(){
    if(busyRef.current) return;
    if(engineRef.current.view().era>=CAP){ setAuto(false); return; }
    busyRef.current = true;
    try{
      const before = engineRef.current.view().log.length;
      engineRef.current.advance();
      const vv = engineRef.current.view();
      sync();
      const souls = vv.houses.reduce((s,h)=>s+h.living,0);
      const ev = vv.log.length - before;
      setStats(prev=>({ ...prev, [vv.era]: {
        year:vv.year, souls, events:ev, dSouls: souls-(prev[vv.era-1]?.souls ?? souls),
        crown: vv.crown? {house:vv.crown.house, leg:vv.crown.legitimacy, faith:vv.crown.stateFaith} : null,
        sword: {holder:vv.sword.holder, state:vv.sword.state, legend:vv.sword.legend},
        faiths: vv.faiths.length, topFaith: vv.faiths.slice().sort((a,b)=>b.vitality-a.vitality)[0]||null,
        grace: vv.grace, empire: vv.empire,
        houses: vv.houses.filter(h=>h.living).map(h=>({n:h.name,d:h.holdings,v:h.overlord})),
      }}));
      if(aiRef.current){
        const era = vv.era;
        const lines = vv.log.slice(before).map(s=>s.replace(/^Era \d+ \([^)]*\) — /,""));
        if(lines.length){
          setNarr(n=>({...n,[era]:{status:"loading"}}));
          try{ const prose = await narrateEra(era, lines, ctxOf(vv)); setNarr(n=>({...n,[era]:{status:"done",prose}})); }
          catch(e){ setNarr(n=>({...n,[era]:{status:"error"}})); }
        }
      }
    } finally { busyRef.current = false; }
  }

  React.useEffect(()=>{ autoRef.current = auto; if(auto) (async()=>{ while(autoRef.current){ if(engineRef.current.view().era>=CAP){ setAuto(false); break; } await step(); await new Promise(r=>setTimeout(r, aiRef.current?300:850)); } })(); /* eslint-disable-next-line */ }, [auto]);
  React.useEffect(()=>{ if(logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [v && v.log.length, narr]);

  if(!v) return null;
  const living = engineRef.current.listLiving();
  const selPerson = sel ? living.find(p=>p.id===sel) : null;

  const act = (fn) => { fn(); setHand(false); setSel(null); sync(); };
  const focusGlyph = {relic:"the blade", line:"the line", god:"the god", reforged:"a new relic"};

  return (
  <div className="scriptorium">
    <style>{CSS}</style>
    <div className="grain"/>
    <header className="topbar">
      <div>
        <h1>Chronicle of the Realm</h1>
        <div className="sub">{v.era===0? "Before the first age" : `Era ${v.era} · ${v.year} AE`} {v.empire && <span className="empire">· the {v.empire} Empire ascendant</span>}</div>
      </div>
      <div className="controls">
        <button className="btn gold" onClick={()=>step()} disabled={v.era>=CAP||auto}>{v.era>=CAP?"The age has closed":"Advance the Age ▸"}</button>
        <button className={"btn "+(auto?"on":"")} onClick={()=>setAuto(a=>!a)} disabled={v.era>=CAP}>{auto?"❚❚ Pause":"▷ Auto"}</button>
        <button className="btn hand" onClick={()=>setHand(h=>!h)}>✶ The Divine Hand</button>
        <button className={"btn "+(useAI?"on":"")} onClick={()=>setUseAI(x=>!x)} title="AI chronicler">✦ Narrator · {useAI?"on":"off"}</button>
        <button className="btn ghost" onClick={()=>{const k=window.prompt("Anthropic API key — stored only in this browser (localStorage), used for narration. Leave blank to clear.", getKey()||""); if(k!==null) setKey(k);}} title="Set your Anthropic API key (needed for the Narrator on the hosted site)">🔑 Key{getKey()?" ✓":""}</button>
        <button className="btn ghost" onClick={()=>fresh(seed)}>↻ New Realm</button>
        <input className="seed" type="number" value={seed} onChange={e=>setSeed(+e.target.value||0)} onBlur={()=>fresh(seed)} title="seed"/>
      </div>
    </header>

    {hand && (
      <div className="handpanel">
        <div className="handhead">
          <span>The god reaches into the world. Choose a soul{selPerson?`: ${selPerson.name} of House ${selPerson.house}`:"…"}</span>
          <button className="x" onClick={()=>{setHand(false);setSel(null);}}>✕</button>
        </div>
        {selPerson ? (
          <div className="actions">
            <button className="btn gold" onClick={()=>act(()=>engineRef.current.nameChosen(sel))}>Name them the Chosen ✦</button>
            {v.sword.state!=="held" && <button className="btn" onClick={()=>act(()=>engineRef.current.bestowSword(sel))}>Bestow the Sword of Archaeleon</button>}
            <button className="btn" onClick={()=>act(()=>engineRef.current.bless(sel))}>Lay a blessing upon them</button>
            <button className="btn ghost" onClick={()=>setSel(null)}>← choose another</button>
          </div>
        ) : (
          <div className="souls">
            {living.slice(0,60).map(p=>(
              <button key={p.id} className={"soul"+(p.chosen?" chosenrow":"")} onClick={()=>setSel(p.id)}>
                <span className="sname">{p.name}{p.holdsSword?" ⚔":""}{p.chosen?" ✦":""}</span>
                <span className="smeta">{p.house} · {p.age}y · renown {p.renown}</span>
              </button>
            ))}
          </div>
        )}
        {v.sword.state==="held" && <button className="btn ghost reclaim" onClick={()=>act(()=>engineRef.current.reclaimSword())}>Reclaim the Sword from the world →</button>}
      </div>
    )}

    <div className="grid">
      <section className="realm">
        <div className="card crown">
          <h2>The Crown</h2>
          {v.crown ? (<>
            <div className="big">{v.crown.monarch||"—"} <span className="of">of House {v.crown.house}</span></div>
            <div className="lbl">Legitimacy</div><Bar v={v.crown.legitimacy} tone={v.crown.legitimacy<0.4?"blood":"gold"}/>
            <div className="faithline">{v.crown.stateFaith? "Sanctified by "+v.crown.stateFaith : "No faith sanctifies the throne"}</div>
          </>) : <div className="muted">No sovereign. The realm lies in interregnum.</div>}
        </div>

        <div className="card">
          <h2>{v.sword.name}</h2>
          {v.sword.holder ? <div className="big">Borne by {v.sword.holder}</div> : <div className="big lost">{v.sword.state==="lost"?"Lost — a thing of legend":v.sword.state}</div>}
          <div className="lbl">Legend</div><Bar v={v.sword.legend} max={30} tone="gold"/>
        </div>

        <div className="card">
          <h2>The Houses</h2>
          <div className="scrollist">
          {[...v.houses].sort((a,b)=>(b.living-a.living)||(b.holdings-a.holdings)).map(h=>(
            <div key={h.id} className={"house"+(h.living?"":" dead")}>
              <span className="hn">{h.name}{v.empire===h.name?" ♛":""}</span>
              <span className="hmeta">{h.living? `${h.lord||"—"} · ${h.living} souls · ${h.holdings} domain${h.holdings===1?"":"s"}${h.overlord?` · vassal of ${h.overlord}`:""}` : "extinct"}</span>
            </div>
          ))}
          </div>
        </div>

        <div className="card">
          <h2>The Faiths</h2>
          {v.faiths.length? v.faiths.map((f,i)=>(
            <div key={i} className="faith">
              <div className="fn">{f.name}</div>
              <div className="fmeta">venerates {focusGlyph[f.focus]} · {f.posture}{f.mem<0.2?" · the god forgotten":""}</div>
              <Bar v={f.vitality} tone="gold"/>
            </div>
          )) : <div className="muted">No faith has yet stirred.</div>}
          <div className="lbl grace">Grace upon the land</div><Bar v={v.grace} max={1.5} tone="sky"/>
        </div>

        {v.chosen && (
          <div className={"card chosencard "+(v.chosen.outcome||"")}>
            <h2>The Chosen</h2>
            <div className="big">{v.chosen.name} <span className="of">of House {v.chosen.house}</span></div>
            <div className="faithline">
              {v.chosen.outcome==="fulfilled"? "The prophecy is fulfilled — the Empire thrown down."
              : v.chosen.outcome==="broken"? "The prophecy lies broken."
              : v.chosen.alive? `Bearing the god's charge against the ${v.empire||"old"} Empire.` : "Fallen."}
            </div>
          </div>
        )}
      </section>

      <section className="chroniclewrap">
        <h2 className="chronh">The Chronicle{useAI && <span className="aibadge">· illuminated by the chronicler</span>}</h2>
        <div className="chronicle" ref={logRef}>
          {(() => {
            const groups = {};
            v.log.forEach(l=>{ const m=l.match(/^Era (\d+) \(([^)]*)\) — (.*)$/); if(m){ const e=+m[1]; (groups[e]=groups[e]||{year:m[2],lines:[]}).lines.push(m[3]); } });
            const eras = Object.keys(groups).map(Number).sort((a,b)=>a-b);
            if(!eras.length) return <p className="muted">The world awaits its first age. Advance to begin.</p>;
            return eras.map(e=>{
              const g=groups[e], nn=narr[e];
              return (
                <div key={e} className="erablock">
                  <div className="erahead">Era {e} · {g.year} AE</div>
                  {nn && nn.status==="done"
                    ? <p className="prose">{nn.prose}</p>
                    : <>
                        {nn && nn.status==="loading" && <p className="scribing">the chronicler sets quill to vellum…</p>}
                        {g.lines.map((t,i)=>{
                          const divine=/DIVINE HAND/.test(t);
                          const war=/War:|crusade|cast down|seizes|rebels|conquest|pretender|civil war/i.test(t);
                          return <p key={i} className={"line"+(divine?" divine":"")+(war?" war":"")}>{t}</p>;
                        })}
                      </>}
                  {stats[e] && (<div className="facts">
                    <span className="stat"><b>Souls</b> {stats[e].souls}{stats[e].dSouls?` (${stats[e].dSouls>0?"+":""}${stats[e].dSouls})`:""}</span>
                    <span className="stat"><b>Crown</b> {stats[e].crown?`${stats[e].crown.house} · ${(stats[e].crown.leg*100|0)}% legit`:"vacant"}</span>
                    <span className="stat"><b>Sword</b> {stats[e].sword.holder?`borne · legend ${stats[e].sword.legend}`:`${stats[e].sword.state} · legend ${stats[e].sword.legend}`}</span>
                    <span className="stat"><b>Faiths</b> {stats[e].faiths}{stats[e].topFaith?` · strongest ${(stats[e].topFaith.vitality*100|0)}%`:""}</span>
                    <span className="stat"><b>Grace</b> {stats[e].grace.toFixed(2)}</span>
                    {stats[e].empire && <span className="stat emp"><b>Empire</b> {stats[e].empire}</span>}
                  </div>)}
                  {stats[e] && <div className="facthouses">{stats[e].houses.map(h=>`${h.n} ·${h.d} dom${h.v?` (vassal of ${h.v})`:""}`).join("    ")}</div>}
                </div>
              );
            });
          })()}
        </div>
      </section>
    </div>
  </div>);
}
