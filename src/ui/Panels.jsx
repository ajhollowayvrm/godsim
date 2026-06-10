import React from "react";
import { faithColor } from "./MapView.jsx";

/* Inspectors: click anything in the world and see its inner life — and, with
   the Divine Hand open, act on it. Every action calls a pure engine method. */

export function Bar({ v, max = 1, tone = "gold" }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (<div className="bar"><span className={"barfill " + tone} style={{ width: pct + "%" }} /></div>);
}

const DRIVE_LIST = ["security", "status", "wealth", "faith", "love", "vengeance", "legacy", "knowledge", "freedom"];

function ActRow({ children }) { return <div className="actions">{children}</div>; }

function PickList({ items, onPick, render, empty }) {
  if (!items.length) return <div className="muted small">{empty ?? "no one suitable"}</div>;
  return (
    <div className="picklist">
      {items.map((it) => (
        <button key={it.id} className="soul" onClick={() => onPick(it)}>{render(it)}</button>
      ))}
    </div>
  );
}

export function RegionPanel({ region, v, hand, act }) {
  const [picking, setPicking] = React.useState(null);
  if (!region) return null;
  const faiths = v.faiths;
  return (
    <div className="card inspector">
      <h2>{region.name}</h2>
      <div className="fmeta">{region.terrain} · {region.culture} folk · {region.ownerName ? `held by House ${region.ownerName}` : "the wilds — no banner flies here"}</div>
      <div className="statgrid">
        <span className="stat"><b>Souls</b> {region.population}k</span>
        <span className="stat"><b>Prosperity</b> {(region.prosperity * 100) | 0}%</span>
        {region.devastation > 0.05 && <span className="stat"><b>Devastation</b> {(region.devastation * 100) | 0}%</span>}
        {region.improvements > 0 && <span className="stat"><b>Works</b> {region.improvements}</span>}
        {region.faith && <span className="stat"><b>Faith</b> {region.faith} ({(region.devotion * 100) | 0}%)</span>}
        {region.sacredTo && <span className="stat"><b>✦ Holy to</b> {region.sacredTo}</span>}
        {region.plague > 0 && <span className="stat emp"><b>☠ Plague</b> raging</span>}
        {region.famine && <span className="stat emp"><b>✗ Famine</b> the granaries are empty</span>}
        {region.atWar && <span className="stat emp"><b>⚔ War</b> armies in the field</span>}
      </div>
      <Bar v={region.prosperity} />
      {hand && (
        <>
          <ActRow>
            <button className="btn hand" onClick={() => act((e) => e.blessLand(region.id))}>Bless this land</button>
            <button className="btn hand" onClick={() => act((e) => e.sendBounty(region.id))}>Send a bounty</button>
            <button className="btn hand" onClick={() => setPicking(picking === "hallow" ? null : "hallow")}>Hallow ground…</button>
            <button className="btn blood" onClick={() => act((e) => e.blightLand(region.id))}>Blight the fields</button>
            <button className="btn blood" onClick={() => act((e) => e.sendPlague(region.id))}>Send plague</button>
          </ActRow>
          {picking === "hallow" && (
            <PickList items={faiths} empty="no living faith to receive it"
              onPick={(f) => { setPicking(null); act((e) => e.hallow(region.id, f.id)); }}
              render={(f) => <span className="sname">✦ for {f.name}</span>} />
          )}
        </>
      )}
    </div>
  );
}

export function PersonPanel({ pid, v, souls, engine, hand, act, onSelectPerson }) {
  const [picking, setPicking] = React.useState(null);
  const s = souls.find((x) => x.id === pid);
  const detail = engine.inspect ? engine.inspect(pid) : null;
  if (!detail) return null;
  const dead = !detail.alive;
  const drives = Object.entries(detail.drives || {}).sort((a, b) => b[1] - a[1]);
  const singles = souls.filter((x) => x.id !== pid && !x.spouse && x.age >= 18 && x.age <= 55 && x.houseId !== s?.houseId).slice(0, 14);
  const artifacts = v.artifacts.filter((a) => a.state !== "destroyed" && a.holderId !== pid);
  return (
    <div className="card inspector">
      <h2>{detail.name} {dead && <span className="of">† {detail.deathCause}</span>}</h2>
      <div className="fmeta">
        of House {detail.house} · {detail.age}y{s?.isMonarch ? " · THE SOVEREIGN" : s?.isLord ? " · lord of the house" : ""}
        {s?.chosen ? " · ✦ the Chosen" : ""}{s?.avatar ? " · THE GOD INCARNATE" : ""}
      </div>
      {s && (
        <div className="statgrid">
          <span className="stat"><b>Renown</b> {s.renown}</span>
          <span className="stat"><b>Prowess</b> {s.prowess}</span>
          <span className="stat"><b>Guile</b> {s.guile}</span>
          <span className="stat"><b>Acumen</b> {s.acumen}</span>
          <span className="stat"><b>Zeal</b> {s.zeal}</span>
          {s.faith && <span className="stat"><b>Faith</b> {s.faith}</span>}
          {s.spouse && <span className="stat"><b>Wed to</b> {s.spouse}</span>}
          {s.artifacts?.length > 0 && <span className="stat"><b>Bears</b> {s.artifacts.join(", ")}</span>}
        </div>
      )}
      <div className="lbl">They want</div>
      <div className="desire">“{detail.desire}”</div>
      {detail.wound && <div className="woundline">Wound: {detail.wound}</div>}
      <div className="lbl">Drives</div>
      {drives.map(([d, w]) => (
        <div key={d} className="driverow"><span className="dlabel">{d}</span><Bar v={w} tone={d === "vengeance" ? "blood" : "gold"} /></div>
      ))}
      <div className="fmeta" style={{ marginTop: 6 }}>{(detail.traits || []).join(" · ")}</div>
      {detail.bonds?.length > 0 && (<>
        <div className="lbl">Bonds</div>
        {detail.bonds.slice(0, 6).map((b, i) => (
          <div key={i} className="bondrow">
            {b.out ? "→" : "←"} <b>{b.with}</b>
            {b.affection > 0.2 ? " · warm" : b.affection < -0.2 ? " · cold" : ""}
            {b.rivalry > 0.3 ? " · rival" : ""}{b.why ? ` (${b.why})` : ""}
          </div>
        ))}
      </>)}
      {detail.deeds?.length > 0 && (<>
        <div className="lbl">Deeds</div>
        {detail.deeds.slice(-4).map((d, i) => <div key={i} className="bondrow">{d}</div>)}
      </>)}
      {hand && !dead && (
        <>
          <ActRow>
            <button className="btn gold" onClick={() => act((e) => e.nameChosen(pid))}>Name them Chosen ✦</button>
            <button className="btn hand" onClick={() => act((e) => e.bless(pid))}>Bless</button>
            <button className="btn hand" onClick={() => setPicking(picking === "whisper" ? null : "whisper")}>Whisper a want…</button>
            <button className="btn hand" onClick={() => setPicking(picking === "marry" ? null : "marry")}>Ordain a marriage…</button>
            <button className="btn hand" onClick={() => setPicking(picking === "bestow" ? null : "bestow")}>Bestow a relic…</button>
            <button className="btn hand" onClick={() => act((e) => e.speakProphecy(pid))}>Prophesy their crown</button>
            <button className="btn blood" onClick={() => act((e) => e.curse(pid))}>Curse</button>
            <button className="btn blood" onClick={() => act((e) => e.smite(pid))}>Smite ⚡</button>
          </ActRow>
          {picking === "whisper" && (
            <div className="picklist">
              {DRIVE_LIST.map((d) => (
                <button key={d} className="soul" onClick={() => { setPicking(null); act((e) => e.whisper(pid, d)); }}>
                  <span className="sname">…{d}</span>
                </button>
              ))}
            </div>
          )}
          {picking === "marry" && (
            <PickList items={singles} empty="no fitting match draws breath"
              onPick={(c) => { setPicking(null); act((e) => e.ordainMarriage(pid, c.id)); }}
              render={(c) => (<><span className="sname">{c.name}</span><span className="smeta">{c.house} · {c.age}y</span></>)} />
          )}
          {picking === "bestow" && (
            <PickList items={artifacts} empty="no relic remains to give"
              onPick={(a) => { setPicking(null); act((e) => e.bestowArtifact(a.id, pid)); }}
              render={(a) => (<><span className="sname">{a.name}</span><span className="smeta">{a.state}{a.holder ? ` · borne by ${a.holder}` : ""}</span></>)} />
          )}
        </>
      )}
      {onSelectPerson && detail.children?.length > 0 && (
        <div className="fmeta" style={{ marginTop: 6 }}>children: {detail.children.map((c) => c.name + (c.alive ? "" : " †")).join(", ")}</div>
      )}
    </div>
  );
}

export function HousePanel({ houseId, v, hand, act, onSelectRegion }) {
  const [picking, setPicking] = React.useState(null);
  const h = v.houses.find((x) => x.id === houseId);
  if (!h) return null;
  const lands = v.regions.filter((r) => r.owner === houseId);
  const others = v.houses.filter((x) => x.id !== houseId && !x.fallen && x.living > 0);
  return (
    <div className="card inspector">
      <h2><span className="chip" style={{ background: h.color }} /> House {h.name} {h.fallen && <span className="of">† fallen</span>}</h2>
      <div className="fmeta">seat: {h.seat} · {h.culture} · {h.living} living souls{h.overlord ? ` · vassal of House ${h.overlord}` : ""}</div>
      <div className="statgrid">
        <span className="stat"><b>Lord</b> {h.lord ?? "—"}</span>
        <span className="stat"><b>Domains</b> {h.holdings}</span>
        <span className="stat"><b>Wealth</b> {h.wealth}</span>
        <span className="stat"><b>Granaries</b> {h.food}</span>
        <span className="stat"><b>Prestige</b> {h.prestige}</span>
        {h.warWeary > 0.3 && <span className="stat emp"><b>War-weary</b> {(h.warWeary * 100) | 0}%</span>}
      </div>
      {h.grudges?.length > 0 && (<>
        <div className="lbl">The house remembers</div>
        {h.grudges.map((g, i) => (
          <div key={i} className="bondrow">against House {g.vs} — {g.reason} <span className="of">({g.weight})</span></div>
        ))}
      </>)}
      <div className="lbl">Lands</div>
      <div className="fmeta">{lands.map((r) => (
        <button key={r.id} className="linklike" onClick={() => onSelectRegion?.(r.id)}>{r.name}</button>
      ))}</div>
      {hand && !h.fallen && (
        <>
          <ActRow>
            <button className="btn hand" onClick={() => act((e) => e.favorHouse(houseId))}>Favor this house</button>
            <button className="btn blood" onClick={() => setPicking(picking === "war" ? null : "war")}>Incite war against…</button>
            <button className="btn hand" onClick={() => setPicking(picking === "peace" ? null : "peace")}>Impose peace with…</button>
          </ActRow>
          {picking === "war" && (
            <PickList items={others} onPick={(t) => { setPicking(null); act((e) => e.inciteWar(houseId, t.id)); }}
              render={(t) => <span className="sname">⚔ House {t.name}</span>} />
          )}
          {picking === "peace" && (
            <PickList items={others} onPick={(t) => { setPicking(null); act((e) => e.imposePeace(houseId, t.id)); }}
              render={(t) => <span className="sname">☮ House {t.name}</span>} />
          )}
        </>
      )}
    </div>
  );
}

export function FaithPanel({ faithName: name, v, hand, act }) {
  const f = v.faiths.find((x) => x.name === name);
  if (!f) return null;
  const creedLine = {
    devout: "holds the god dear and present",
    fearful: "fears what the god has shown itself to be",
    doubtful: "wonders aloud whether the god still listens",
    defiant: "preaches against the throne of heaven itself",
  }[f.creed];
  return (
    <div className="card inspector">
      <h2><span className="chip" style={{ background: faithColor(f.name, v.faiths) }} />{f.name}</h2>
      <div className="fmeta">venerates {f.focus} · {f.posture} · holds {f.regions} region{f.regions === 1 ? "" : "s"}{f.patron ? ` · championed by House ${f.patron}` : ""}</div>
      <div className="lbl">Vitality</div><Bar v={f.vitality} />
      <div className="lbl">Zeal</div><Bar v={f.zeal} tone="blood" />
      <div className="lbl">Memory of the god</div><Bar v={f.mem} tone="sky" />
      <div className="statgrid" style={{ marginTop: 8 }}>
        <span className="stat"><b>Doctrine</b> {f.doctrines.join(" · ")}</span>
        {f.sacred?.length > 0 && <span className="stat"><b>✦ Holy ground</b> {f.sacred.join(", ")}</span>}
        {f.founder && <span className="stat"><b>Founder</b> {f.founder}</span>}
        {f.parent && <span className="stat"><b>Schismed from</b> {f.parent}</span>}
      </div>
      <div className="desire" style={{ marginTop: 6 }}>Its creed {creedLine}.</div>
      {hand && (
        <ActRow>
          <button className="btn hand" onClick={() => act((e) => e.emboldenFaith(f.id))}>Embolden</button>
          <button className="btn blood" onClick={() => act((e) => e.witherFaith(f.id))}>Wither</button>
          <button className="btn blood" onClick={() => act((e) => e.sparkSchism(f.id))}>Spark schism</button>
        </ActRow>
      )}
    </div>
  );
}

export function ArtifactPanel({ artifactId, v, souls, hand, act }) {
  const [picking, setPicking] = React.useState(false);
  const a = v.artifacts.find((x) => x.id === artifactId);
  if (!a) return null;
  const worthies = souls.filter((p) => p.id !== a?.holderId).slice(0, 14);
  return (
    <div className="card inspector">
      <h2>{a.name}</h2>
      <div className="fmeta">
        {a.state === "held" ? `borne by ${a.holder} of House ${a.holderHouse}` : a.state === "lost" ? `lost${a.lostIn ? ` somewhere in ${a.lostIn}` : ""}` : a.state}
        {" · "}power of {a.power} · it wants {a.wants}
      </div>
      <div className="lbl">Legend</div><Bar v={a.legend} max={30} />
      <div className="statgrid">
        <span className="stat"><b>Will</b> {(a.will * 100) | 0}%</span>
        <span className="stat"><b>Knows</b> the {a.attune}-haired</span>
      </div>
      {a.custody?.length > 0 && (<>
        <div className="lbl">The chain of custody</div>
        {a.custody.map((c, i) => <div key={i} className="bondrow">E{c.era}: {c.holder} — {c.how}</div>)}
      </>)}
      {hand && a.state !== "destroyed" && (
        <>
          <ActRow>
            <button className="btn hand" onClick={() => setPicking(!picking)}>Place in a mortal hand…</button>
            {a.state === "held" && <button className="btn blood" onClick={() => act((e) => e.reclaimArtifact(a.id))}>Reclaim from the world</button>}
          </ActRow>
          {picking && (
            <PickList items={worthies} onPick={(p) => { setPicking(false); act((e) => e.bestowArtifact(a.id, p.id)); }}
              render={(p) => (<><span className="sname">{p.name}</span><span className="smeta">{p.house} · renown {p.renown}</span></>)} />
          )}
        </>
      )}
    </div>
  );
}

export function DeityPanel({ v, vows, hand, act, onRewind, era }) {
  const [vowPick, setVowPick] = React.useState(false);
  const [housePick, setHousePick] = React.useState(false);
  const [rewindTo, setRewindTo] = React.useState("");
  const d = v.deity;
  return (
    <div className="card inspector">
      <h2>The God</h2>
      <div className="statgrid">
        <span className="stat"><b>Acts</b> {d.acts}</span>
        <span className="stat"><b>Grace on the land</b> {v.grace}</span>
        {d.adversary !== "none" && (
          <span className="stat emp"><b>Adversary</b> {d.adversaryName}{d.adversaryDefeated ? " (defeated)" : d.adversaryChampion ? ` · champion ${d.adversaryChampion}` : ""}</span>
        )}
      </div>
      <div className="lbl">The Vow</div>
      {d.vow ? (
        <div className={"desire" + (d.vow.broken ? " broken" : "")}>
          “{d.vow.text}”{d.vow.broken ? ` — BROKEN in era ${d.vow.brokenEra}.` : " — unbroken."}
        </div>
      ) : <div className="muted small">No vow binds the god.</div>}
      {hand && (
        <>
          <ActRow>
            {!d.vow && <button className="btn hand" onClick={() => setVowPick(!vowPick)}>Swear a vow…</button>}
            {!d.incarnation && <button className="btn gold" onClick={() => setHousePick(!housePick)}>Descend — Incarnate…</button>}
            {d.incarnation && <button className="btn hand" onClick={() => act((e) => e.ascend())}>Ascend — return to heaven</button>}
            <button className="btn hand" onClick={() => act((e) => e.kindleFaith())}>Kindle a faith</button>
            <button className="btn hand" onClick={() => act((e) => e.forgeArtifact())}>Forge a relic</button>
            <button className="btn hand" onClick={() => act((e) => e.speakProphecy())}>Speak a doom</button>
          </ActRow>
          {vowPick && (
            <div className="picklist">
              {Object.entries(vows).filter(([k]) => k !== "none").map(([k, def]) => (
                <button key={k} className="soul" onClick={() => { setVowPick(false); act((e) => e.setVow(k)); }}>
                  <span className="sname">{k}</span><span className="smeta">{def.text}</span>
                </button>
              ))}
            </div>
          )}
          {housePick && (
            <PickList items={v.houses.filter((h) => !h.fallen && h.living > 0)}
              onPick={(h) => { setHousePick(false); act((e) => e.incarnate(h.id)); }}
              render={(h) => (<><span className="sname">into House {h.name}</span><span className="smeta">{h.seat}</span></>)} />
          )}
        </>
      )}
      {d.incarnation && (
        <div className="desire" style={{ marginTop: 8 }}>
          Walking the world as <b>{d.incarnation.name}</b> of House {d.incarnation.house}{d.incarnation.humbled ? " — humbled, but unkillable" : ""}.
          <div className="fmeta">{d.incarnation.backstory}</div>
        </div>
      )}
      {era > 1 && (
        <>
          <div className="lbl">Time itself</div>
          <div className="actions">
            <input className="seed" type="number" min="0" max={era - 1} placeholder={`era 0–${era - 1}`}
              value={rewindTo} onChange={(e) => setRewindTo(e.target.value)} />
            <button className="btn hand" disabled={rewindTo === "" || +rewindTo >= era || +rewindTo < 0}
              onClick={() => onRewind(+rewindTo)}>⟲ Unwind the years</button>
          </div>
          <div className="muted small">The same seed replays the same history — your divine acts included.</div>
        </>
      )}
    </div>
  );
}
