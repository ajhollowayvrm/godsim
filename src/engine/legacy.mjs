function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function boot(seed){
  let RAND = mulberry32(seed);
  let era = 0;
const rnd = () => RAND();
const chance = p => rnd() < p;
const pick = arr => arr[Math.floor(rnd()*arr.length)];

// ── procedural peoples: cultures, generated names, a large ever-different cast ──
const CULT = [
  { key:"Highland", pre:["Bran","Gor","Hald","Sten","Vael","Wyr","Kor","Eir","Thar","Osk","Grim","Aeld","Dun","Rua","Hroth"], suf:["mund","dric","var","gar","sten","wyn","ric","dis","na","or","eth","a","is","wen","ld"],
    hair:["silver","ash-grey","iron-black","flaxen"], hroot:["Vael","Stenmark","Korrin","Haldis","Eiry","Wyrlund","Grimmel","Aeldric","Osgar","Hrothwen"], adj:["Grey","Ash","Iron","High","Storm","Cold","North"], geo:["Ridge","March","Hold","Reach","Crag","Fell","Watch"] },
  { key:"Riverland", pre:["Cor","Mae","Ys","Bren","Lys","Niam","Ria","Soa","Elen","Cael","Aoi","Wen","Mira"], suf:["mae","lin","wyn","dra","nys","sel","ond","ra","th","ven","is","la"],
    hair:["auburn","copper","chestnut","honey"], hroot:["Corremae","Lyswyn","Brenond","Caelra","Niamhel","Aoira","Miravel","Soawyn"], adj:["Lake","River","Green","Willow","Mist","Reed","Silver"], geo:["Hollow","Vale","Water","Ford","Meadow","Bend","Mere"] },
  { key:"Sunland", pre:["Zar","Aza","Sef","Tah","Ral","Mor","Vash","Iss","Ome","Kha","Rua","Sab"], suf:["iq","an","eh","ya","im","ra","oun","el","is","ad","ene","ir"],
    hair:["raven-black","dark-bronze","umber","jet"], hroot:["Zariq","Azael","Vashir","Sefan","Khaoun","Omede","Ralhan","Sabiq"], adj:["Sun","Gold","Amber","Dune","Ember","Bright"], geo:["Sands","Spire","Gate","Steppe","Bazaar","Reach"] },
  { key:"Marshfolk", pre:["Oth","Yth","Vor","Mol","Gris","Een","Ul","Nyx","Ssa","Vesh","Hael","Wend"], suf:["oth","yx","ul","ven","gore","mire","ish","na","ek","ra","wen","is"],
    hair:["bone-white","moss-green","slate","tar-black"], hroot:["Othmire","Ythgore","Vorul","Veshna","Wendish","Nyxal","Molra","Griseth"], adj:["Black","Fen","Bog","Pale","Drowned","Grey"], geo:["Marsh","Fen","Moor","Hollow","Drift","Reach"] },
];
const givenName = c => pick(c.pre) + pick(c.suf);
const seatOf = c => chance(0.5) ? "the "+pick(c.adj)+" "+pick(c.geo) : pick(c.adj)+pick(c.geo).toLowerCase();
const HOUSES = (()=>{ const arr=[], used=new Set(), N=12;
  for(let i=0;i<N;i++){ const c=CULT[i%CULT.length]; let name=pick(c.hroot),g=0;
    while(used.has(name)&&g++<24) name=pick(c.hroot)+pick(c.suf);
    used.add(name);
    arr.push({ id:"h"+i, name, seat:seatOf(c), culture:c.key, hair:pick(c.hair), holdings:1, overlordId:null, loyalty:1 });
  } return arr; })();
const cultOf = id => CULT.find(c=>c.key===((HOUSES.find(h=>h.id===id)||{}).culture)) || CULT[0];

// ── state ──
let people = {};
let nextId = 1;
const roman = n => ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"][n] || (""+n);
const newPerson = (houseId, era, parents=[], inheritHair=null) => {
  const id = "p"+(nextId++);
  // a child often honors a departed forebear of the house — recorded as a namesake
  let baseName, namedAfter=null;
  const ancestors = parents.length ? Object.values(people).filter(p=>p.houseId===houseId && !p.alive) : [];
  if(ancestors.length && chance(0.4)){ const h=pick(ancestors); baseName=h.baseName||h.name; namedAfter=h.id; }
  else baseName = givenName(cultOf(houseId));
  const ord = Object.values(people).filter(p=>p.houseId===houseId && (p.baseName||p.name)===baseName).length + 1;
  people[id] = {
    id, baseName, namedAfter, name: baseName + (ord>1? " "+roman(ord) : ""),
    houseId, bornEra: era, parents,
    alive: true, diedEra: null, spouseId: null, claims: [houseId],
    hair: inheritHair ?? HOUSES.find(h=>h.id===houseId).hair,
    prowess: clamp(avgParent(parents,"prowess",0.5) + jitter(), 0, 1),
    ambition: clamp(avgParent(parents,"ambition",0.5) + jitter(), 0, 1),
    guile: clamp(avgParent(parents,"guile",0.5) + jitter(), 0, 1),
  };
  const me = people[id];
  parents.forEach(pid=>{ const par=people[pid]; if(par) par.claims.forEach(c=>{ if(!me.claims.includes(c)) me.claims.push(c); }); });
  return me;
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const jitter=()=> (rnd()-0.5)*0.4;
const avgParent=(parents,k,def)=>{const ps=parents.map(id=>people[id]).filter(Boolean);return ps.length?ps.reduce((s,p)=>s+p[k],0)/ps.length:def;};
const ageOf = (p, era) => (era - p.bornEra) * 25;
const living = () => Object.values(people).filter(p=>p.alive);
const houseLiving = h => living().filter(p=>p.houseId===h);

// offices: one hereditary lordship per house + one realm-wide contested seat
let offices = {};
HOUSES.forEach(h => offices["lord_"+h.id] = { id:"lord_"+h.id, title:`Lord of ${h.seat}`, houseId:h.id, holderId:null, hereditary:true });
offices["captain"] = { id:"captain", title:"High Captain of the Realm", houseId:null, holderId:null, hereditary:false };

// the Sword of Archaeleon — a willful artifact. It starts LOST to the world,
// waiting for a worthy hand. Whoever holds it is far more formidable (renown +0.5),
// so across generations the blade itself reshapes who rules.
let sword = { name:"the "+pick(["Sword","Blade","Crown","Chalice","Spear","Shard","Banner","Sceptre","Horn","Mirror"])+" of "+(pick(CULT[0].pre)+pick(CULT[0].suf)), holderId:null, state:"lost", legend:0, will:0.8, attune: pick(HOUSES.map(h=>h.hair)) };
const holdsSword = id => sword.holderId===id;
const renown = (p, era) => (p.prowess*0.6 + p.ambition*0.2 + Math.min(ageOf(p,era)/80,1)*0.2) + (holdsSword(p.id)?0.5:0) + (p.chosen?0.6:0);

// faiths emerge, SCHISM, war, and fall on their own. Each venerates a different
// focus — the relic, the bloodline, the (fading) god, or a new relic raised in
// the old one's place — and rival creeds suppress one another when zeal runs hot.
const GOD_NAME = "the Hand of Heaven";
let faiths = [];
let faithSeq = 1;
let grace = 0;   // mercy upon the land — benevolent faiths raise it, crusades spend it

// ── the realm: a paramount Crown + a web of house relations ──
let crown = { houseId:null, holderId:null, legitimacy:0.5, stateFaithId:null, since:0 };
const relations = {};                                   // pairwise, -1 (war) .. +1 (allied)
const relKey = (a,b)=> [a,b].sort().join("|");
const rel    = (a,b)=> relations[relKey(a,b)] ?? 0;
const setRel = (a,b,v)=> relations[relKey(a,b)] = clamp(v,-1,1);
const adjRel = (a,b,d)=> setRel(a,b, rel(a,b)+d);

// person-to-person bonds — the substrate of intrigue (rivalry, hatred, fealty)
let bonds = [];
function addBond(a,b,kind,amt,era){
  let bd = bonds.find(x=>x.from===a&&x.to===b&&x.kind===kind);
  if(!bd){ bd={from:a,to:b,kind,intensity:0,since:era}; bonds.push(bd); }
  bd.intensity = clamp(bd.intensity+amt,0,1); return bd;
}
const hasBond = (a,b,kind)=> bonds.find(x=>x.from===a&&x.to===b&&x.kind===kind);

// the divine hand — a single intervention by the god
let chosen=null, empireHouseId=null, intervened=false, prophecyOutcome=null;
const FOCUS_NAMES = {
  relic:    ["the Order of the Silver Hand","the Keepers of the Blade"],
  line:     ["the Silver Communion","the Covenant of the Line"],
  god:      ["the Penitents of the Hand","the Old Communion"],
  reforged: ["the Reforged","the Church of the New Dawn"],
};
const FOCUS_CREED = { relic:"the Sword itself", line:"the silver bloodline", god:GOD_NAME, reforged:"a new relic raised in the old one's place" };
const POSTURES = ["militant","evangelical","insular","syncretic","benevolent"];
function faithName(focus){
  const used = new Set(faiths.map(f=>f.name));
  const free = FOCUS_NAMES[focus].filter(n=>!used.has(n));
  if(free.length) return pick(free);
  return pick(FOCUS_NAMES[focus]) + " " + pick(["the Elder","the Younger","Reformed","Ascendant","in Exile"]);
}
function foundFaith(focus, era, parentId=null, vitality=0.5, posture=null){
  const f = { id:"f"+(faithSeq++), name:faithName(focus), focus, foundedEra:era, parentId,
    vitality, memoryOfGod: focus==="god"?0.9:0.6, zeal:0.4+rnd()*0.3,
    posture: posture ?? pick(POSTURES), patronHouseId:null, dissolvedEra:null };
  faiths.push(f); return f;
}
const livingFaiths = () => faiths.filter(f=>!f.dissolvedEra);

// ── seed: a founder per house ──
HOUSES.forEach(h => { let lord=null; const n=3+Math.floor(rnd()*2);
  for(let k=0;k<n;k++){ const f=newPerson(h.id,0); f.bornEra=0; if(!lord||f.prowess>lord.prowess) lord=f; }
  offices["lord_"+h.id].holderId=lord.id; h.holdings=1; h.overlordId=null; h.loyalty=1; });

// ── the chronicle (what the narrator would render; here, templated) ──
const chronicle = [];
const tell = (era, line) => chronicle.push(`Era ${era} (${1000+era*25} AE) — ${line}`);

// ── phases ──
function phaseDemography(era){
  // births: a house's fertile adults bear the next generation (up to two per age)
  HOUSES.forEach(h=>{
    const adults = houseLiving(h.id).filter(p=>{const a=ageOf(p,era);return a>=18&&a<=55;});
    if(!adults.length) return;
    const nBirths = (chance(0.9)?1:0) + (adults.length>=2 && chance(0.55)?1:0);
    for(let b=0;b<nBirths;b++){
      const parent = pick(adults);
      const sigHair = chance(0.7) ? (HOUSES.find(x=>x.id===h.id).hair) : pick(CULT[Math.floor(rnd()*CULT.length)].hair);
      const ps = (parent.spouseId && people[parent.spouseId]?.alive) ? [parent.id, parent.spouseId] : [parent.id];
      const child = newPerson(h.id, era, ps, sigHair);
      if(child.hair===sword.attune && chance(0.4))
        tell(era, `A child of House ${h.name} is born ${sword.attune}-haired — the old folk whisper of ${sword.name}.`);
    }
  });
  // deaths: probability climbs with age — but GRACE from benevolent faiths spares some
  const mercy = clamp(grace, 0, 0.6);
  living().forEach(p=>{
    const a = ageOf(p,era);
    const base = a<55?0.04 : a<75?0.2 : a<90?0.55 : 0.95;
    if(chance(base*(1-mercy)*(p.chosen?0.3:1))){ p.alive=false; p.diedEra=era; }
  });
  grace = clamp(grace*0.6, 0, 1.5); // mercy fades unless renewed
}

function phaseArtifacts(era){
  const bearer = people[sword.holderId];
  // bearer dead → the blade seeks an heir of the same house; else it is lost
  if(sword.state==="held" && (!bearer || !bearer.alive)){
    const house = bearer ? bearer.houseId : null;
    const kin = house ? houseLiving(house).filter(p=>ageOf(p,era)>=16).sort((a,b)=>renown(b,era)-renown(a,era)) : [];
    if(kin.length){
      sword.holderId = kin[0].id; sword.legend++;
      tell(era, swordLine(kin[0], `takes up ${sword.name}`));
    } else {
      sword.holderId = null; sword.state="lost";
      tell(era, `${sword.name} passes out of mortal hands and into legend — its bearer dead, its house spent.`);
    }
  }
  // lost/mythic → its legend swells as rumor, and a worthy soul may be chosen by it
  if(sword.state==="lost"){
    sword.legend += 0.5;
    const seekers = living().filter(p=>ageOf(p,era)>=18).sort((a,b)=>renown(b,era)-renown(a,era));
    if(seekers.length && chance(sword.will*0.6)){
      const found = seekers[0];
      sword.holderId = found.id; sword.state="held"; sword.legend++;
      tell(era, swordLine(found, `draws ${sword.name} from where it lay`));
    } else if(chance(0.3)){
      tell(era, `Pretenders quarrel over where ${sword.name} is said to lie; none return.`);
    }
  }
}
// the blade is rumored to "know" silver-haired (Vael) blood
const swordLine = (p, verb) => {
  const sil = p.hair===sword.attune ? ` — and they say the relic knew its own, the bearer being ${sword.attune}-haired` : "";
  return `${p.name} of House ${nm(p)} ${verb}${sil}.`;
};

function phasePolitics(era){
  // hereditary succession
  HOUSES.forEach(h=>{
    const seat = offices["lord_"+h.id];
    const holder = people[seat.holderId];
    if(!holder || !holder.alive){
      const heirs = houseLiving(h.id).sort((a,b)=> renown(b,era)-renown(a,era));
      if(heirs.length){
        const heir = heirs[0];
        const how = holder ? "inherits" : "claims";
        seat.holderId = heir.id;
        tell(era, `${heir.name} of House ${h.name} ${how} the seat of ${seat.title.replace("Lord of ","")} as Lord.`);
      } else {
        if(seat.holderId!==null) tell(era, `House ${h.name} fails — no heir remains to hold ${seat.title.replace("Lord of ","")}. The line passes into legend.`);
        seat.holderId = null;
      }
    }
  });
  // contested High Captaincy: best renown holds it; the ambitious can usurp
  const cap = offices["captain"];
  const holder = people[cap.holderId];
  const field = living().filter(p=>ageOf(p,era)>=20).sort((a,b)=>renown(b,era)-renown(a,era));
  if(!field.length) return;
  const top = field[0];
  if(!holder || !holder.alive){
    cap.holderId = top.id;
    tell(era, `${top.name} of House ${nm(top)} is acclaimed High Captain of the Realm.`);
    if(holdsSword(top.id)){ sword.legend+=2; tell(era, `With ${sword.name} raised in peace, its legend turns toward GIFT — a blade of deliverance.`); }
  } else if(top.id!==holder.id && renown(top,era) > renown(holder,era)*1.15 && top.ambition>0.6 && chance(0.7)){
    cap.holderId = top.id;
    const byBlade = holdsSword(top.id);
    tell(era, `${top.name} of House ${nm(top)} casts down ${holder.name} and seizes the High Captaincy by force.`);
    if(byBlade){ sword.legend+=2; tell(era, `${sword.name} ran red this day — its legend turns toward JUDGMENT, a thing of dread.`); }
  }
}
const nm = p => HOUSES.find(h=>h.id===p.houseId).name;

function phaseFaith(era){
  // the first faith crystallizes around the Sword
  if(!faiths.length && sword.legend>=8 && living().length){
    const f = foundFaith("relic", era);
    tell(era, `An Order rises around ${sword.name}, naming ${GOD_NAME} as the power that loosed it. ${f.name} is founded.`);
  }
  const hasRelic = sword.state==="held";

  // vitality drift, forgetting, and each faith fills its own High Keeper seat
  for(const f of livingFaiths()){
    let pull = 0.04;
    if(f.focus==="relic")   pull += hasRelic? 0.06 : -0.02;
    if(f.focus==="line")    pull += 0.05;
    if(f.focus==="reforged")pull += 0.05;
    f.vitality = clamp(f.vitality + pull + (rnd()-0.5)*0.05, 0.1, 1);
    f.memoryOfGod = clamp(f.memoryOfGod + (f.focus==="god"? 0.04 : -0.12), 0, 1);

    const oid = "keeper_"+f.id;
    if(!offices[oid]) offices[oid] = { id:oid, title:`High Keeper of ${f.name}`, holderId:null };
    const kh = people[offices[oid].holderId];
    if(!kh || !kh.alive){
      const devout = living().filter(p=>ageOf(p,era)>=20).sort((a,b)=>renown(b,era)-renown(a,era));
      if(devout.length) offices[oid].holderId = devout[0].id;
    }
  }

  // SCHISM — a vital faith fractures along its deepest strain
  for(const f of livingFaiths()){
    const strain = (f.focus==="relic" && !hasRelic ? 0.35 : 0) + (f.memoryOfGod < 0.25 ? 0.2 : 0) + 0.12;
    if(f.vitality > 0.6 && chance(strain) && livingFaiths().length < 4){
      const newFocus = f.focus==="relic" ? pick(["line","reforged","god"])
                     : f.focus==="line"  ? pick(["reforged","god"])
                     : f.focus==="god"   ? "reforged" : "line";
      const child = foundFaith(newFocus, era, f.id, 0.45, pick(["militant","benevolent","evangelical","insular","syncretic"]));
      f.vitality = clamp(f.vitality-0.2,0.1,1);
      f.zeal = clamp(f.zeal+0.2,0,1); child.zeal = clamp(child.zeal+0.2,0,1);
      tell(era, `${f.name} is torn in schism: a breakaway raises ${child.name}, holding that true devotion belongs to ${FOCUS_CREED[newFocus]}, not ${FOCUS_CREED[f.focus]}.`);
    }
  }

  // PATRONAGE — a faith may win the backing of a house (its martial muscle)
  for(const f of livingFaiths()){
    if(!f.patronHouseId && chance(0.4)){
      const taken = new Set(livingFaiths().map(x=>x.patronHouseId).filter(Boolean));
      const cand = HOUSES.filter(h=>houseLiving(h.id).length && !taken.has(h.id))
                         .sort((a,b)=> houseMight(b.id,era)-houseMight(a.id,era));
      if(cand.length){ f.patronHouseId = cand[0].id; tell(era, `House ${cand[0].name} takes up the cause of ${f.name}.`); }
    }
  }

  // RELIGIOUS ACTION — posture + conditions decide what each faith DOES. Anything is possible:
  // crusade, conversion, communion, or quiet coexistence. Nothing is scripted.
  for(const f of livingFaiths()){
    const rivals = livingFaiths().filter(x=>x!==f && !x.dissolvedEra);
    if(!rivals.length) continue;
    const rival = pick(rivals);
    if(f.posture==="militant" && f.patronHouseId && chance(0.35 + f.zeal*0.3)){
      crusade(f, rival, era);                                  // HOLY WAR
    } else if(f.posture==="evangelical" && chance(0.4)){
      const take = Math.min(0.15, rival.vitality*0.3);
      rival.vitality=clamp(rival.vitality-take,0,1); f.vitality=clamp(f.vitality+take,0,1);
      tell(era, `${f.name} wins converts from ${rival.name}, swelling its flock.`);
    } else if(f.posture==="syncretic" && rival.zeal<0.6 && chance(0.35)){
      f.vitality=clamp(f.vitality+rival.vitality*0.5,0,1); rival.dissolvedEra=era;
      tell(era, `${f.name} and ${rival.name} enter communion and become one faith.`);
    } else if(f.posture==="benevolent" && chance(0.6)){
      grace = clamp(grace + 0.4, 0, 1.5);                      // succor the people
      f.vitality = clamp(f.vitality + 0.05, 0, 1);
      let line = `${f.name} opens its doors in hard times — the sick are tended, the hungry fed, the poor sheltered.`;
      const hot = livingFaiths().filter(x=>x!==f).sort((a,b)=>b.zeal-a.zeal)[0];
      if(hot && hot.zeal>0.6){ hot.zeal=clamp(hot.zeal-0.25,0,1); line += ` It brokers peace, and ${hot.name} lowers its banners.`; }
      tell(era, line);
    } // insular → abides quietly, content to endure
  }

  // COLLAPSE — a faith that loses all vitality simply withers
  for(const f of livingFaiths()) if(f.vitality<0.12){ f.dissolvedEra=era; tell(era,`${f.name} withers and is no more.`); }
}

const houseOf = hid => HOUSES.find(h=>h.id===hid);
const houseHasSword = hid => sword.holderId && people[sword.holderId]?.houseId===hid;
function houseMight(hid, era){
  const lev = houseLiving(hid).filter(p=>ageOf(p,era)>=18).reduce((s,p)=>s+p.prowess,0);
  const h = houseOf(hid);
  return lev * (1 + 0.6*Math.max(0,((h?.holdings||1)-1))) * (houseHasSword(hid)?1.3:1);
}

function crusade(f, target, era){
  const goalRelic = f.focus==="relic" && sword.state==="held";
  const fm = houseMight(f.patronHouseId,era)*1.5 + f.vitality*f.zeal;
  const tm = (target.patronHouseId? houseMight(target.patronHouseId,era)*1.5:0) + target.vitality*target.zeal + 0.3;
  const goal = goalRelic ? `to seize ${sword.name}` : `to cleanse the heretics of ${target.name}`;
  tell(era, `${f.name} proclaims a CRUSADE ${goal}; the host of House ${HOUSES.find(h=>h.id===f.patronHouseId).name} marches.`);
  if(fm > tm*(0.85+rnd()*0.3)){
    target.vitality = clamp(target.vitality-0.5,0,1);
    if(target.patronHouseId){
      houseLiving(target.patronHouseId).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,2).forEach(p=>{p.alive=false;p.diedEra=era;});
    }
    if(goalRelic){
      const top = houseLiving(f.patronHouseId).sort((a,b)=>renown(b,era)-renown(a,era))[0];
      if(top){ sword.holderId=top.id; sword.legend+=3; tell(era, `${sword.name} is taken in holy war — borne now by ${top.name} of House ${nm(top)}; its legend turns to JUDGMENT.`); }
    }
    tell(era, `The crusade triumphs; ${target.name} is broken and scattered.`);
    if(target.vitality<=0.15){ target.dissolvedEra=era; tell(era, `${target.name} is extinguished.`); }
  } else {
    f.vitality = clamp(f.vitality-0.3,0,1);
    if(f.patronHouseId){
      houseLiving(f.patronHouseId).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,2).forEach(p=>{p.alive=false;p.diedEra=era;});
    }
    tell(era, `The crusade is broken before the walls; ${f.name} bleeds and falls back.`);
  }
  grace = clamp(grace-0.15,0,1.5); // holy war brings suffering to the land
}

// ── realm helpers ──
function houseLord(hid){ return people[offices["lord_"+hid]?.holderId]; }
function eligibleSingles(hid, era){ return houseLiving(hid).filter(p=>ageOf(p,era)>=18 && ageOf(p,era)<=55 && !p.spouseId); }
function houseAllies(hid){ return HOUSES.filter(h=>h.id!==hid && rel(h.id,hid)>0.3).map(h=>h.id); }
function houseVassals(hid){ return HOUSES.filter(h=>h.overlordId===hid).map(h=>h.id); }
function realmMight(hid, era){
  return houseMight(hid,era)
    + houseAllies(hid).reduce((s,a)=>s+houseMight(a,era)*0.5,0)
    + houseVassals(hid).reduce((s,a)=>s+houseMight(a,era)*0.5,0);
}

function phaseDiplomacy(era){
  // faith pulls houses together or apart: shared patron faith → amity, opposed → enmity
  const lf = livingFaiths();
  for(let i=0;i<lf.length;i++) for(let j=i+1;j<lf.length;j++){
    const a=lf[i].patronHouseId, b=lf[j].patronHouseId;
    if(a&&b&&a!==b) adjRel(a,b, lf[i].focus!==lf[j].focus ? -0.08 : 0.05);
  }
  // marriages bind houses: pair two non-hostile houses with eligible singles
  const hs = HOUSES.filter(h=>houseLiving(h.id).length);
  for(let i=0;i<hs.length;i++) for(let j=i+1;j<hs.length;j++){
    if(rel(hs[i].id,hs[j].id) < -0.3 || !chance(0.25)) continue;
    const a = pick(eligibleSingles(hs[i].id,era)), b = pick(eligibleSingles(hs[j].id,era));
    if(a&&b){ a.spouseId=b.id; b.spouseId=a.id; adjRel(hs[i].id,hs[j].id,0.4);
      tell(era, `A marriage binds House ${hs[i].name} and House ${hs[j].name} — ${a.name} weds ${b.name}.`); }
  }
  Object.keys(relations).forEach(k=> relations[k]*=0.9);   // relations cool toward neutral
}

function phaseCrown(era){
  const lf = livingFaiths();
  // FOUND the Crown once a strong claimant exists
  if(!crown.houseId){
    const lords = HOUSES.map(h=>houseLord(h.id)).filter(Boolean).sort((a,b)=>renown(b,era)-renown(a,era));
    if(lords.length && era>=2){
      const k=lords[0]; Object.assign(crown,{houseId:k.houseId,holderId:k.id,legitimacy:0.55,since:era});
      tell(era, `House ${nm(k)} ascends: ${k.name} is crowned first sovereign of the realm.`);
    }
    return;
  }
  let monarch = people[crown.holderId];

  // SUCCESSION — claims (incl. those won by marriage) decide the heirs; disputes can split the realm
  if(!monarch || !monarch.alive){
    const claimants = living().filter(p=>p.claims.includes(crown.houseId)).sort((a,b)=>renown(b,era)-renown(a,era));
    const heir = claimants[0];
    if(!heir){ Object.assign(crown,{houseId:null,holderId:null}); tell(era,`The Crown falls vacant — no claimant remains. The realm enters interregnum.`); return; }
    crown.holderId=heir.id; crown.houseId=heir.houseId;
    if(ageOf(heir,era)<16){
      const regent = houseLiving(heir.houseId).filter(p=>ageOf(p,era)>=20).sort((a,b)=>renown(b,era)-renown(a,era))[0];
      crown.legitimacy=clamp(crown.legitimacy-0.1,0,1);
      tell(era, `${heir.name} of House ${nm(heir)} inherits the Crown a child; ${regent?regent.name+" rules as regent":"the realm wavers without a regent"}.`);
    } else { crown.legitimacy=clamp(0.55,0,1); tell(era, `${heir.name} of House ${nm(heir)} inherits the Crown.`); }
    const rivalClaim = claimants.find(c=>c.houseId!==heir.houseId && renown(c,era) > renown(heir,era)*0.8);
    if(rivalClaim){ crown.legitimacy=clamp(crown.legitimacy-0.15,0,1); tell(era, `${rivalClaim.name} of House ${nm(rivalClaim)} disputes the succession — the realm holds its breath.`); }
    monarch = people[crown.holderId];
  }

  // ── RELIGION ⇄ CROWN ──
  // a state faith that has fallen leaves the Crown without sanction
  if(crown.stateFaithId && !lf.find(f=>f.id===crown.stateFaithId)){
    crown.stateFaithId=null; crown.legitimacy=clamp(crown.legitimacy-0.1,0,1);
    tell(era, `The faith of the realm has fallen; the Crown stands without sanction, and men murmur.`);
  }
  // BENEFIT: elevate a state faith; throne and altar prop each other up
  if(!crown.stateFaithId && lf.length && chance(0.5)){
    const sf = lf.find(f=>f.patronHouseId===crown.houseId) || lf.slice().sort((a,b)=>b.vitality-a.vitality)[0];
    crown.stateFaithId=sf.id; sf.vitality=clamp(sf.vitality+0.15,0,1); crown.legitimacy=clamp(crown.legitimacy+0.15,0,1);
    tell(era, `The Crown elevates ${sf.name} as the faith of the realm; throne and altar bind together.`);
  }
  const sf = lf.find(f=>f.id===crown.stateFaithId);
  if(sf){ crown.legitimacy=clamp(crown.legitimacy+0.05,0,1); sf.vitality=clamp(sf.vitality+0.04,0,1); if(sf.posture==="benevolent") grace=clamp(grace+0.15,0,1.5); }

  // OPPOSE: a hostile faith may denounce the Crown; the Crown may suppress it, at the cost of martyrs
  for(const f of lf){
    if(f.id===crown.stateFaithId) continue;
    const hostile = f.posture==="militant" || (f.patronHouseId && rel(f.patronHouseId,crown.houseId)<-0.2) || (sf && f.focus!==sf.focus && f.zeal>0.6);
    if(hostile && chance(0.3)){
      crown.legitimacy=clamp(crown.legitimacy-0.15,0,1); f.zeal=clamp(f.zeal+0.1,0,1);
      tell(era, `${f.name} denounces the Crown as unworthy; ${monarch.name}'s legitimacy frays.`);
      if(chance(0.5)){
        f.vitality=clamp(f.vitality-0.4,0,1); crown.legitimacy=clamp(crown.legitimacy-0.08,0,1); f.zeal=clamp(f.zeal+0.15,0,1);
        tell(era, `The Crown moves to suppress ${f.name} — its faithful are scattered, but martyrs stir unrest.`);
        if(f.vitality<=0.12){ f.dissolvedEra=era; tell(era, `${f.name} is broken by the Crown.`); }
      }
    }
  }

  // legitimacy drifts toward 0.5; a weak throne with a strong rival invites CIVIL WAR
  crown.legitimacy = clamp(crown.legitimacy + (0.5-crown.legitimacy)*0.1, 0, 1);
  if(crown.legitimacy < 0.4){
    const ch = HOUSES.filter(h=>h.id!==crown.houseId && houseLiving(h.id).length).sort((a,b)=>realmMight(b.id,era)-realmMight(a.id,era))[0];
    if(ch && chance(0.5)){
      const condemning = lf.find(f=>f.id!==crown.stateFaithId && f.patronHouseId===ch.id);
      const mMight = realmMight(crown.houseId,era) + crown.legitimacy + (sf? sf.vitality*sf.zeal : 0);
      const cMight = realmMight(ch.id,era) + (condemning? condemning.vitality*condemning.zeal : 0) + 0.2;
      tell(era, `House ${ch.name} raises a pretender — civil war engulfs the realm${condemning?`, blessed by ${condemning.name}`:""}${sf?`; the throne is defended by ${sf.name}`:""}.`);
      if(cMight > mMight*(0.9+rnd()*0.2)){
        const winner = houseLiving(ch.id).sort((a,b)=>renown(b,era)-renown(a,era))[0];
        houseLiving(crown.houseId).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,2).forEach(p=>{p.alive=false;p.diedEra=era;});
        Object.assign(crown,{houseId:ch.id,holderId:winner.id,legitimacy:0.35,stateFaithId:condemning?condemning.id:null});
        tell(era, `The pretender triumphs; ${winner.name} of House ${ch.name} seizes the Crown by force.`); grace=clamp(grace-0.2,0,1.5);
      } else {
        houseLiving(ch.id).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,2).forEach(p=>{p.alive=false;p.diedEra=era;});
        crown.legitimacy=clamp(crown.legitimacy+0.2,0,1);
        tell(era, `The rebellion is crushed; ${monarch.name} keeps the throne, its right reaffirmed in blood.`);
      }
    }
  }
}

// ── war: conquest, vassalage, and rebellion ──
function warBetween(A, D, era, kind){
  const am = realmMight(A.id,era) + (kind==="royal"&&crown.houseId===A.id? crown.legitimacy:0);
  const dm = realmMight(D.id,era) + (D.overlordId? houseMight(D.overlordId,era)*0.4 : 0) + 0.15;
  const verb = kind==="rebellion" ? "war of independence" : kind==="royal" ? "royal war" : "war of conquest";
  tell(era, `War: House ${A.name} wages a ${verb} upon House ${D.name}.`);
  const fall = (H)=> houseLiving(H.id).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,1).forEach(p=>{p.alive=false;p.diedEra=era;});
  adjRel(A.id,D.id,-0.4);
  if(am > dm*(0.82+rnd()*0.2)){
    fall(D);
    if(kind==="rebellion"){
      A.overlordId=null; A.loyalty=1;
      tell(era, `House ${A.name} throws off its chains and stands free.`);
      if(D.holdings>1 && chance(0.4)){ D.holdings--; A.holdings++; tell(era,`It tears a domain from House ${D.name} in the bargain.`); }
    } else {
      const overwhelming = am > dm*1.8;
      if((D.holdings>1 || D.overlordId || overwhelming) && chance(0.7)){
        D.holdings = Math.max(0, D.holdings-1); A.holdings++;
        if(D.holdings<=0){ D.overlordId=A.id; D.loyalty=0.5; tell(era, `House ${A.name} strips House ${D.name} of its last domain and swallows it whole.`); }
        else tell(era, `House ${A.name} annexes a domain of House ${D.name}.`);
      } else { D.overlordId=A.id; D.loyalty=0.6; tell(era, `House ${D.name} bends the knee as vassal to House ${A.name}.`); }
    }
  } else {
    fall(A);
    if(kind==="rebellion"){ A.loyalty=0.6; if(A.holdings>1){A.holdings--; D.holdings++;} tell(era, `The rising is broken; House ${A.name} is brought low and its lands pared.`); }
    else tell(era, `House ${D.name} repels the assault; House ${A.name} falls back bloodied.`);
  }
  grace=clamp(grace-0.1,0,1.5);
}

function phaseWar(era){
  const active = HOUSES.filter(h=>houseLiving(h.id).length);
  // CONQUEST — an ambitious free house makes war on a rival or weaker neighbor
  for(const a of active){
    if(a.overlordId) continue;
    const lord = houseLord(a.id); if(!lord) continue;
    const targets = active.filter(t=>t!==a && t.overlordId!==a.id);
    if(!targets.length) continue;
    const target = targets.sort((x,y)=> (rel(a.id,y.id)-rel(a.id,x.id)) || (realmMight(x.id,era)-realmMight(y.id,era)))[0];
    const wantWar = rel(a.id,target.id) < -0.25 || (lord.ambition>0.55 && realmMight(a.id,era) > realmMight(target.id,era)*1.2);
    if(wantWar && chance(0.45 + lord.ambition*0.3)) warBetween(a, target, era, "conquest");
  }
  // REBELLION — a vassal's loyalty erodes; the bold throw off their overlord
  for(const v of active){
    if(!v.overlordId) continue;
    const lord = houseLord(v.id);
    v.loyalty = clamp((v.loyalty??1) - 0.08 - (lord?lord.ambition*0.05:0) + (rel(v.id,v.overlordId)>0.3?0.06:0), 0, 1);
    if(v.loyalty < 0.35 && chance(0.55)) warBetween(v, houseOf(v.overlordId), era, "rebellion");
  }
  // the CROWN brings an over-mighty rival to heel
  if(crown.houseId){
    const royal = houseOf(crown.houseId);
    const overMighty = active.find(h=>h!==royal && h.overlordId!==crown.houseId && realmMight(h.id,era) > realmMight(crown.houseId,era)*1.3);
    if(overMighty && chance(0.3)) warBetween(royal, overMighty, era, "royal");
  }
}

function phaseIntrigue(era){
  if(!crown.holderId) return;
  const monarch = people[crown.holderId]; if(!monarch || !monarch.alive) return;
  const court = living().filter(p=>ageOf(p,era)>=18);

  // RIVALRIES form: ambitious notables covet the throne
  court.filter(p=>p.id!==monarch.id && p.ambition>0.55 && (p.claims.includes(crown.houseId) || renown(p,era)>renown(monarch,era)))
       .forEach(r=> addBond(r.id, monarch.id, "rivalry", 0.2, era));

  // BETRAYAL of oaths: a sworn lord of a house hostile to the Crown turns traitor
  for(const h of HOUSES){
    if(h.id===crown.houseId || !houseLiving(h.id).length) continue;
    const lord = houseLord(h.id);
    if(lord && rel(h.id,crown.houseId) < -0.3 && lord.ambition>0.5 && chance(0.25)){
      addBond(lord.id, monarch.id, "hatred", 0.3, era);
      tell(era, `${lord.name} of House ${h.name}, once sworn to the Crown, turns traitor and intrigues against ${monarch.name}.`);
    }
  }

  // the most dangerous schemer steps from the shadows
  const plotters = court.filter(p=> hasBond(p.id,monarch.id,"rivalry") || hasBond(p.id,monarch.id,"hatred"));
  if(!plotters.length) return;
  const plotter = plotters.sort((a,b)=> (b.guile+b.ambition)-(a.guile+a.ambition))[0];

  // ASSASSINATION — a knife in the dark, not an army in the field
  if(chance(0.2 + plotter.guile*0.3)){
    const protection = renown(monarch,era)*0.5 + crown.legitimacy*0.4 + houseAllies(crown.houseId).length*0.1;
    if(plotter.guile + plotter.ambition*0.3 > protection*(0.8+rnd()*0.5)){
      monarch.alive=false; monarch.diedEra=era;
      tell(era, `${monarch.name} is found dead — poison in the cup — and every eye turns to ${plotter.name} of House ${nm(plotter)}.`);
      if(plotter.claims.includes(crown.houseId) || plotter.ambition>0.7){
        crown.holderId=plotter.id; crown.houseId=plotter.houseId; crown.legitimacy=0.3;
        tell(era, `In the confusion ${plotter.name} seizes the Crown — a throne taken by stealth, not by right.`);
      }
    } else {
      tell(era, `A plot against ${monarch.name} is uncovered; ${plotter.name} of House ${nm(plotter)} is ${chance(0.5)?"executed":"cast into exile"}.`);
      plotter.alive=false; plotter.diedEra=era;
      crown.legitimacy=clamp(crown.legitimacy+0.05,0,1);
    }
  }
  // COUP — when the throne is weak, a backed rival forces an abdication without a sword
  else if(crown.legitimacy<0.35 && renown(plotter,era)>renown(monarch,era) && chance(0.4)){
    tell(era, `${plotter.name} of House ${nm(plotter)} marshals the court and forces ${monarch.name} to abdicate — a coup without a blade.`);
    crown.holderId=plotter.id; crown.houseId=plotter.houseId; crown.legitimacy=0.4;
  }
}

function divineHand(era){
  if(intervened || !crown.houseId || era<5) return;
  const hegemon = houseOf(crown.houseId);
  if(!(houseVassals(crown.houseId).length>=2 || hegemon.holdings>=2)) return;   // wait for a true empire
  empireHouseId = crown.houseId; intervened = true;
  const young = living().filter(p=>ageOf(p,era)<16 && p.houseId!==empireHouseId);
  const oppressed = young.filter(p=> houseOf(p.houseId).overlordId===empireHouseId || rel(p.houseId,empireHouseId)<0);
  const boy = (oppressed.length?oppressed:young).sort((a,b)=>renown(a,era)-renown(b,era))[0];
  if(!boy){ intervened=false; empireHouseId=null; return; }
  chosen = boy;
  boy.prowess=clamp(boy.prowess+0.4,0,1); boy.ambition=clamp(boy.ambition+0.5,0,1); boy.guile=clamp(boy.guile+0.3,0,1); boy.chosen=true;
  tell(era, `— THE DIVINE HAND — In a gutter of ${houseOf(boy.houseId).seat}, the god appears to ${boy.name}, a destitute child of House ${nm(boy)}, and names him the one foretold to bring down the ${hegemon.name} Empire.`);
}

function phaseChosen(era){
  if(!chosen || prophecyOutcome) return;
  if(!chosen.alive){ prophecyOutcome="broken"; tell(era, `${chosen.name}, the god's chosen, falls in the struggle — the prophecy broken.`); return; }
  if(ageOf(chosen,era)<16 || !empireHouseId) return;
  const emp = houseOf(empireHouseId);
  if(!emp || !houseLiving(empireHouseId).length || crown.houseId!==empireHouseId){
    prophecyOutcome="fulfilled"; tell(era, `The ${emp?emp.name:"old"} Empire is thrown down. ${chosen.name}, once a beggar child, has done as the god foretold.`); empireHouseId=null; return;
  }
  // rally the oppressed — the empire's vassals defect, its enemies flock to the banner
  const rebels = HOUSES.filter(h=>houseLiving(h.id).length && h.id!==empireHouseId && (h.overlordId===empireHouseId || rel(h.id,empireHouseId)<0 || h.id===chosen.houseId));
  rebels.forEach(h=>{ if(h.id!==chosen.houseId) adjRel(chosen.houseId,h.id,0.4);
    if(h.overlordId===empireHouseId && chance(0.5)){ h.overlordId=null; h.loyalty=1; tell(era,`House ${h.name} forsakes the Empire and joins ${chosen.name}.`); } });
  // the war of liberation: coalition + divine favor vs the empire
  const allyMight = rebels.reduce((s,h)=> s + houseMight(h.id,era)*(h.id===chosen.houseId?1:0.6), 0) + 0.8;
  const empMight = realmMight(empireHouseId,era) + crown.legitimacy;
  tell(era, `${chosen.name} leads the host of the foretold against the ${emp.name} Empire.`);
  if(allyMight > empMight*(0.85+rnd()*0.2)){
    houseLiving(empireHouseId).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,2).forEach(p=>{p.alive=false;p.diedEra=era;});
    HOUSES.filter(h=>h.overlordId===empireHouseId).forEach(h=>{h.overlordId=null;h.loyalty=1;});
    Object.assign(crown,{houseId:chosen.houseId,holderId:chosen.id,legitimacy:0.7,stateFaithId:null});
    prophecyOutcome="fulfilled";
    tell(era, `The ${emp.name} Empire is cast down. ${chosen.name}, once a beggar of ${houseOf(chosen.houseId).seat}, takes the Crown — the god's word made flesh.`);
    grace=clamp(grace+0.4,0,1.5); empireHouseId=null;
  } else {
    houseLiving(chosen.houseId).filter(p=>p.id!==chosen.id).sort((a,b)=>renown(a,era)-renown(b,era)).slice(0,1).forEach(p=>{p.alive=false;p.diedEra=era;});
    crown.legitimacy=clamp(crown.legitimacy-0.1,0,1);
    tell(era, `The rising is checked, but the ${emp.name} Empire is shaken; ${chosen.name} withdraws to gather strength.`);
  }
}


  // ── player interventions: the divine hand ──
  function computeEmpire(){
    const score = h => (h.holdings||1) + houseVassals(h.id).length*1.5 + (crown.houseId===h.id?1:0);
    return HOUSES.filter(h=>houseLiving(h.id).length).sort((a,b)=>score(b)-score(a))[0]?.id || null;
  }
  function nameChosen(id){
    const p = people[id]; if(!p||!p.alive) return;
    empireHouseId = computeEmpire(); intervened=true; prophecyOutcome=null; chosen=p;
    p.prowess=clamp(p.prowess+0.4,0,1); p.ambition=clamp(p.ambition+0.5,0,1); p.guile=clamp(p.guile+0.3,0,1); p.chosen=true;
    const emp = houseOf(empireHouseId);
    tell(era, `— THE DIVINE HAND — The god appears to ${p.name} of House ${nm(p)} and names them the one foretold to bring down ${emp?("the "+emp.name+" Empire"):"the mighty"}.`);
  }
  function bestowSword(id){ const p=people[id]; if(!p||!p.alive) return; sword.holderId=id; sword.state="held"; sword.legend+=1; tell(era,`— THE DIVINE HAND — The god sets ${sword.name} into the hand of ${p.name} of House ${nm(p)}.`); }
  function reclaimSword(){ if(sword.holderId){ const h=people[sword.holderId]; tell(era, `— THE DIVINE HAND — The god reclaims ${sword.name}${h?" from "+h.name:""}; it passes out of the world into legend.`);} sword.holderId=null; sword.state="lost"; }
  function bless(id){ const p=people[id]; if(!p||!p.alive) return; p.prowess=clamp(p.prowess+0.25,0,1); p.ambition=clamp(p.ambition+0.15,0,1); if(crown.holderId===id) crown.legitimacy=clamp(crown.legitimacy+0.2,0,1); tell(era, `— THE DIVINE HAND — A blessing of the god settles upon ${p.name} of House ${nm(p)}.`); }

  function advance(){
    era++;
    phaseDemography(era); phaseDiplomacy(era); phaseArtifacts(era); phasePolitics(era);
    phaseWar(era); phaseFaith(era); phaseCrown(era); phaseIntrigue(era); phaseChosen(era);
  }
  function view(){
    const m = people[crown.holderId];
    const sf = faiths.find(f=>f.id===crown.stateFaithId);
    const sb = people[sword.holderId];
    return {
      era, year:1000+era*25,
      houses: HOUSES.map(h=>({ id:h.id, name:h.name, seat:h.seat, living:houseLiving(h.id).length,
        lord:(people[offices["lord_"+h.id]?.holderId]||{}).name||null, holdings:h.holdings,
        overlord: h.overlordId? houseOf(h.overlordId).name:null })),
      crown: crown.houseId? { house:houseOf(crown.houseId).name, monarch:m?m.name:null, legitimacy:crown.legitimacy, stateFaith:sf?sf.name:null } : null,
      faiths: faiths.filter(f=>!f.dissolvedEra).map(f=>({ name:f.name, focus:f.focus, posture:f.posture, vitality:f.vitality, mem:f.memoryOfGod })),
      sword: { name:sword.name, holder: sb?(sb.name+" of House "+nm(sb)):null, state:sword.state, legend:Math.round(sword.legend) },
      grace, empire: empireHouseId? (houseOf(empireHouseId)||{}).name : null,
      chosen: chosen? { name:chosen.name, house:nm(chosen), alive:chosen.alive, outcome:prophecyOutcome } : null,
      log: chronicle.slice(),
    };
  }
  function listLiving(){
    return living().map(p=>({ id:p.id, name:p.name, house:nm(p), houseId:p.houseId, age:ageOf(p,era),
      renown:+renown(p,era).toFixed(2), chosen:!!p.chosen, holdsSword:holdsSword(p.id) }))
      .sort((a,b)=>b.renown-a.renown);
  }
  return { advance, view, nameChosen, bestowSword, bless, reclaimSword, listLiving, computeEmpire };
}
