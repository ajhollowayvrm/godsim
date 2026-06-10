import React from "react";

/* The illuminated chronicle: grouped by era, significant events surfaced,
   minor ones folded, and every consequence traceable back to its cause. */

function EventLine({ e, byId, onJumpActor, nameOf }) {
  const [open, setOpen] = React.useState(false);
  const cls = "line" + (e.divine ? " divine" : "") +
    (/war|battle|crusade|usurpation|murder|godslayer/.test(e.kind) ? " war" : "") +
    (e.importance === 3 ? " major" : "");
  const causes = (e.causedBy || []).map((id) => byId[id]).filter(Boolean);
  return (
    <div>
      <p className={cls} onClick={() => (causes.length || e.actors?.length) && setOpen(!open)}
        style={causes.length || e.actors?.length ? { cursor: "pointer" } : undefined}>
        {e.importance === 3 ? "✦ " : ""}{e.text}
        {causes.length > 0 && <span className="whychip">{open ? " ▾" : " · why?"}</span>}
      </p>
      {open && (
        <div className="causebox">
          {causes.length > 0 && (<>
            <div className="lbl">Because…</div>
            {causes.map((c) => <p key={c.id} className="line small">E{c.era}: {c.text}</p>)}
          </>)}
          {e.motive && <div className="fmeta">moved by {e.motive}</div>}
          {e.actors?.length > 0 && onJumpActor && (
            <div className="actions" style={{ marginTop: 4 }}>
              {e.actors.map((id) => (
                <button key={id} className="linklike" onClick={() => onJumpActor(id)}>{nameOf ? nameOf(id) : id} →</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Chronicle({ v, narr, stats, onJumpActor, nameOf, logRef }) {
  const byEra = {};
  for (const e of v.events) (byEra[e.era] = byEra[e.era] || []).push(e);
  const byId = {};
  for (const e of v.events) byId[e.id] = e;
  const eras = Object.keys(byEra).map(Number).sort((a, b) => a - b);
  const [unfolded, setUnfolded] = React.useState({});

  if (!eras.length) return (
    <div className="chronicle" ref={logRef}>
      <p className="muted">The world awaits its first age. Advance to begin — or reach in with the Divine Hand first.</p>
    </div>
  );

  return (
    <div className="chronicle" ref={logRef}>
      {eras.map((era) => {
        const all = byEra[era];
        const major = all.filter((e) => e.importance >= 2);
        const minor = all.filter((e) => e.importance < 2);
        const nn = narr[era];
        const st = stats[era];
        const showMinor = unfolded[era];
        return (
          <div key={era} className="erablock">
            <div className="erahead">Era {era} · {1000 + era * 25} AE{st?.mood ? ` · ${st.mood}` : ""}</div>
            {nn && nn.status === "done"
              ? <p className="prose">{nn.prose}</p>
              : (<>
                {nn && nn.status === "loading" && <p className="scribing">the chronicler sets quill to vellum…</p>}
                {major.map((e) => <EventLine key={e.id} e={e} byId={byId} onJumpActor={onJumpActor} nameOf={nameOf} />)}
                {minor.length > 0 && (
                  <button className="linklike fold" onClick={() => setUnfolded((u) => ({ ...u, [era]: !u[era] }))}>
                    {showMinor ? "▾ fold the lesser happenings" : `▸ ${minor.length} lesser happening${minor.length === 1 ? "" : "s"}`}
                  </button>
                )}
                {showMinor && minor.map((e) => <EventLine key={e.id} e={e} byId={byId} onJumpActor={onJumpActor} nameOf={nameOf} />)}
              </>)}
            {st && (
              <div className="facts">
                <span className="stat"><b>Souls</b> {st.population}k</span>
                <span className="stat"><b>Tracked</b> {st.tracked}</span>
                <span className="stat"><b>Crown</b> {st.crown ? `${st.crown.house} · ${(st.crown.legitimacy * 100) | 0}%` : "vacant"}</span>
                <span className="stat"><b>Faiths</b> {st.faiths}</span>
                <span className="stat"><b>Grace</b> {st.grace}</span>
                <span className="stat"><b>Tech</b> {st.techsKnown}</span>
                {st.activeWars > 0 && <span className="stat emp"><b>Wars</b> {st.activeWars}</span>}
                {st.plaguedRegions > 0 && <span className="stat emp"><b>☠</b> {st.plaguedRegions} regions</span>}
                {st.empire && <span className="stat emp"><b>Empire</b> {st.empire}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
