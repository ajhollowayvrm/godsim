/** Culture-driven procedural naming: people, houses, regions, faiths, artifacts. */
import type { RNG } from "./rng";
import { chance, pick } from "./rng";
import type { Culture } from "./types";

export const CULTURE_SEEDS: Omit<Culture, "values" | "customs" | "tech" | "succession">[] = [
  {
    key: "Highland",
    namePre: ["Bran", "Gor", "Hald", "Sten", "Vael", "Wyr", "Kor", "Eir", "Thar", "Osk", "Grim", "Aeld", "Dun", "Rua", "Hroth"],
    nameSuf: ["mund", "dric", "var", "gar", "sten", "wyn", "ric", "dis", "na", "or", "eth", "a", "is", "wen", "ld"],
    hair: ["silver", "ash-grey", "iron-black", "flaxen"],
    houseRoots: ["Vael", "Stenmark", "Korrin", "Haldis", "Eiry", "Wyrlund", "Grimmel", "Aeldric", "Osgar", "Hrothwen"],
    seatAdj: ["Grey", "Ash", "Iron", "High", "Storm", "Cold", "North"],
    seatGeo: ["Ridge", "March", "Hold", "Reach", "Crag", "Fell", "Watch"],
  },
  {
    key: "Riverland",
    namePre: ["Cor", "Mae", "Ys", "Bren", "Lys", "Niam", "Ria", "Soa", "Elen", "Cael", "Aoi", "Wen", "Mira"],
    nameSuf: ["mae", "lin", "wyn", "dra", "nys", "sel", "ond", "ra", "th", "ven", "is", "la"],
    hair: ["auburn", "copper", "chestnut", "honey"],
    houseRoots: ["Corremae", "Lyswyn", "Brenond", "Caelra", "Niamhel", "Aoira", "Miravel", "Soawyn"],
    seatAdj: ["Lake", "River", "Green", "Willow", "Mist", "Reed", "Silver"],
    seatGeo: ["Hollow", "Vale", "Water", "Ford", "Meadow", "Bend", "Mere"],
  },
  {
    key: "Sunland",
    namePre: ["Zar", "Aza", "Sef", "Tah", "Ral", "Mor", "Vash", "Iss", "Ome", "Kha", "Rua", "Sab"],
    nameSuf: ["iq", "an", "eh", "ya", "im", "ra", "oun", "el", "is", "ad", "ene", "ir"],
    hair: ["raven-black", "dark-bronze", "umber", "jet"],
    houseRoots: ["Zariq", "Azael", "Vashir", "Sefan", "Khaoun", "Omede", "Ralhan", "Sabiq"],
    seatAdj: ["Sun", "Gold", "Amber", "Dune", "Ember", "Bright"],
    seatGeo: ["Sands", "Spire", "Gate", "Steppe", "Bazaar", "Reach"],
  },
  {
    key: "Marshfolk",
    namePre: ["Oth", "Yth", "Vor", "Mol", "Gris", "Een", "Ul", "Nyx", "Ssa", "Vesh", "Hael", "Wend"],
    nameSuf: ["oth", "yx", "ul", "ven", "gore", "mire", "ish", "na", "ek", "ra", "wen", "is"],
    hair: ["bone-white", "moss-green", "slate", "tar-black"],
    houseRoots: ["Othmire", "Ythgore", "Vorul", "Veshna", "Wendish", "Nyxal", "Molra", "Griseth"],
    seatAdj: ["Black", "Fen", "Bog", "Pale", "Drowned", "Grey"],
    seatGeo: ["Marsh", "Fen", "Moor", "Hollow", "Drift", "Reach"],
  },
];

export const givenName = (r: RNG, c: Culture) => pick(r, c.namePre) + pick(r, c.nameSuf);

export const seatName = (r: RNG, c: Culture) =>
  chance(r, 0.5) ? "the " + pick(r, c.seatAdj) + " " + pick(r, c.seatGeo)
                 : pick(r, c.seatAdj) + pick(r, c.seatGeo).toLowerCase();

export const regionName = (r: RNG, c: Culture, used: Set<string>) => {
  for (let i = 0; i < 30; i++) {
    const n = seatName(r, c);
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = seatName(r, c) + " Beyond";
  used.add(n); return n;
};

export const houseName = (r: RNG, c: Culture, used: Set<string>) => {
  let name = pick(r, c.houseRoots), g = 0;
  while (used.has(name) && g++ < 24) name = pick(r, c.houseRoots) + pick(r, c.nameSuf);
  used.add(name); return name;
};

const ARTIFACT_KINDS = ["Sword", "Blade", "Crown", "Chalice", "Spear", "Shard", "Banner", "Sceptre", "Horn", "Mirror", "Lantern", "Harp"];
export const artifactName = (r: RNG, c: Culture, used: Set<string>) => {
  for (let i = 0; i < 30; i++) {
    const kind = pick(r, ARTIFACT_KINDS);
    const n = "the " + kind + " of " + (pick(r, c.namePre) + pick(r, c.nameSuf));
    if (!used.has(n)) { used.add(n); return { name: n, kind }; }
  }
  const kind = pick(r, ARTIFACT_KINDS);
  const n = "the Elder " + kind;
  used.add(n); return { name: n, kind };
};

export const GOD_NAME = "the Hand of Heaven";

const FAITH_PATTERNS: Record<string, string[]> = {
  relic: ["the Order of {X}", "the Keepers of {X}", "the Brotherhood of {X}", "the Vigil of {X}"],
  line: ["the {A} Communion", "the Covenant of the Line", "the Blood of {X}", "the {A} Compact"],
  god: ["the Penitents of the Hand", "the Old Communion", "the Listeners", "the Church of the Unseen Hand"],
  reforged: ["the Reforged", "the Church of the New Dawn", "the Second Flame", "the Risen Creed"],
  salvation: ["the Mercy of {A}", "the Sheltering Hand", "the Gleaners", "the Last Lamp"],
  ancestor: ["the {A} Remembrance", "the Hall of Fathers", "the Long Memory", "the Elder Watch"],
  doom: ["the Cult of the Closing Sky", "the Mourners of {A}", "the Ashen Choir", "the Last Vigil"],
};
const FAITH_ADJ = ["Silver", "Hollow", "Burning", "Quiet", "Sable", "Golden", "Pale", "Deep"];

export function faithName(r: RNG, focus: string, x: string | null, used: Set<string>): string {
  const pats = FAITH_PATTERNS[focus] ?? FAITH_PATTERNS.god;
  for (let i = 0; i < 30; i++) {
    let n = pick(r, pats).replace("{X}", x ?? "the Relic").replace("{A}", pick(r, FAITH_ADJ));
    if (used.has(n)) n = n + " " + pick(r, ["the Elder", "the Younger", "Reformed", "Ascendant", "in Exile"]);
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = "the Nameless Creed";
  used.add(n); return n;
}

export const ADVERSARY_NAMES = ["the Veiled One", "the Hollow King Below", "the Whisper Between Stars", "the Unmaker"];
export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
export const roman = (n: number) => ROMAN[n] || ("" + n);
