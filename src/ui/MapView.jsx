import React from "react";

/* The living atlas: a flat-top hex map of the realm with togglable overlays.
   Pure render of EngineView.regions — clicking a hex selects it. */

const TERRAIN_FILL = {
  plain: "#4f4a2c", hill: "#5d5036", mountain: "#5c5852", forest: "#39492f",
  marsh: "#38473d", desert: "#7a6238", coast: "#37505f", steppe: "#625a30",
};
const TERRAIN_GLYPH = { mountain: "▲", forest: "♣", marsh: "≈", desert: "·", coast: "~", hill: "◠", steppe: "—", plain: "" };

/** Stable hue from the faith's NAME — colors never shift when another faith dissolves. */
export const faithColor = (name, faiths) => {
  if (!name || !faiths.some((f) => f.name === name)) return "#262118"; // the faith is gone; the land remembers nothing
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${((h % 360) + 360) % 360} 45% 42%)`;
};
const CULTURE_HUE = { Highland: 210, Riverland: 130, Sunland: 40, Marshfolk: 290 };
const cultureColor = (key) => {
  const base = key.replace(/^Old /, "");
  const h = CULTURE_HUE[base] ?? 0;
  return `hsl(${h} ${key.startsWith("Old") ? 25 : 40}% 38%)`;
};

const SIZE = 30;
const hexPoints = (cx, cy) => {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    pts.push(`${(cx + SIZE * Math.cos(a)).toFixed(1)},${(cy + SIZE * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
};
const center = (col, row) => [SIZE * 1.5 * col + SIZE, Math.sqrt(3) * SIZE * (row + 0.5 * (col & 1)) + SIZE];

export default function MapView({ regions, faiths, overlay, selectedId, onSelect }) {
  const maxCol = Math.max(...regions.map((r) => r.col));
  const maxRow = Math.max(...regions.map((r) => r.row));
  const width = SIZE * 1.5 * maxCol + SIZE * 2.6;
  const height = Math.sqrt(3) * SIZE * (maxRow + 1.6);

  const fillOf = (r) => {
    if (overlay === "realms") return r.ownerColor ?? "#221d13"; // banners, not biomes
    if (overlay === "faith") return r.faith ? faithColor(r.faith, faiths) : "#262118";
    if (overlay === "prosperity") {
      const p = r.prosperity;
      return `hsl(${Math.round(p * 90)} ${30 + p * 35}% ${14 + p * 26}%)`;
    }
    if (overlay === "culture") return cultureColor(r.culture);
    return TERRAIN_FILL[r.terrain] ?? "#444";
  };

  return (
    <svg className="map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="map of the realm">
      {regions.map((r) => {
        const [cx, cy] = center(r.col, r.row);
        const sel = r.id === selectedId;
        const stroke = sel ? "#e6c878" : overlay === "terrain" && r.ownerColor ? r.ownerColor : "#1c170e";
        return (
          <g key={r.id} onClick={() => onSelect(r.id)} style={{ cursor: "pointer" }}>
            <polygon
              points={hexPoints(cx, cy)}
              fill={fillOf(r)}
              opacity={r.devastation > 0.3 ? 0.75 : 1}
              stroke={stroke}
              strokeWidth={sel ? 3 : overlay === "terrain" && r.ownerColor ? 2.2 : 1}
            />
            {r.devastation > 0.3 && <polygon points={hexPoints(cx, cy)} fill="#000" opacity={r.devastation * 0.4} pointerEvents="none" />}
            <text x={cx} y={cy - 7} textAnchor="middle" fontSize="9" fill="#cdbd97" opacity="0.55" pointerEvents="none">
              {TERRAIN_GLYPH[r.terrain]}
            </text>
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8.5" fill="#e7dab4" opacity="0.9" pointerEvents="none"
              style={{ fontFamily: "'EB Garamond',serif" }}>
              {r.name.replace(/^the /, "").length > 11 ? r.name.replace(/^the /, "").slice(0, 10) + "…" : r.name.replace(/^the /, "")}
            </text>
            <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9" pointerEvents="none">
              {r.atWar ? "⚔" : ""}{r.plague > 0 ? "☠" : ""}{r.famine ? "✗" : ""}{r.sacredTo ? "✦" : ""}
            </text>
            <title>
              {`${r.name} — ${r.terrain}\n${r.ownerName ? "House " + r.ownerName : "the wilds"} · ${r.culture}\npop ${r.population}k · prosperity ${(r.prosperity * 100) | 0}%${r.faith ? `\n${r.faith} (${(r.devotion * 100) | 0}%)` : ""}${r.sacredTo ? `\nholy ground of ${r.sacredTo}` : ""}${r.plague ? "\nPLAGUE" : ""}${r.famine ? "\nFAMINE" : ""}`}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
