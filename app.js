/* ═══════════════════════════════════════════════════════════
   สนามคำศัพท์ — ตรรกะเกมทั้งหมด
   แก้ค่าต่างๆ ได้ที่ config.js ไม่ต้องแตะไฟล์นี้
   ═══════════════════════════════════════════════════════════ */
"use strict";

const CFG = window.VA_CONFIG;
const R = CFG.RULES;

const MODES = {
  rush: {
    label: "⏱ ตะลุยเวลา", short: "ตะลุยเวลา",
    note: "จับเวลาทั้งเกม ตอบให้ได้มากที่สุด · ตอบผิดหักเวลา " + R.rushPenalty + " วินาที · ตอบถูกติดกันได้ตัวคูณคอมโบ — โหมดหลักสำหรับแข่งกัน"
  },
  survive: {
    label: "💀 อึดไม่ตาย", short: "อึดไม่ตาย",
    note: "ตอบผิดหรือหมดเวลาแม้ข้อเดียว = จบเกมทันที วัดกันที่ใครไปได้ไกลกว่ากัน"
  },
  duel: {
    label: "🎯 ท้าดวล", short: "ท้าดวล",
    note: "ทั้งสองฝ่ายใส่รหัสดวลเดียวกัน จะได้คำถามชุดเดียวกันเป๊ะ เรียงเหมือนกัน ตัวเลือกเหมือนกัน — ยุติธรรมที่สุด และกระดานจะเทียบเฉพาะคนที่เล่นรหัสนี้"
  }
};

/* ── สถานะ ───────────────────────────────────────────── */
const S = {
  name: "", level: CFG.LEVELS[0], mode: "rush", cat: "", code: "",
  score: 0, correct: 0, asked: 0, streak: 0, bestStreak: 0,
  queue: [], q: null, missed: [], qStart: 0,
  timeLeft: 0, tick: null, nextT: null, locked: false, playing: false
};

const OPT = {
  size: "m", theme: "auto", sound: true, reverse: false, speak: false,
  rushSecs: R.rushSeconds, perSecs: R.surviveSeconds
};

const DB = {};            // ข้อมูลคำศัพท์ที่โหลดแล้ว
let ONLINE = false;       // ต่อ Supabase ได้หรือไม่

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = n => n.toLocaleString("en-US");

/* ── เก็บค่าลงเครื่อง ─────────────────────────────────── */
const LS = {
  get(k, d) { try { const v = localStorage.getItem("va." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("va." + k, JSON.stringify(v)); } catch { } }
};

/* ── สุ่มแบบมีเมล็ด: รหัสดวลเดียวกัน = ชุดคำเดียวกัน ──── */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const randCode = () => {
  let c = "";
  for (let i = 0; i < 4; i++) c += "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)];
  return c;
};

/* ═══ กระดานคะแนน ════════════════════════════════════════
   ออนไลน์ = Supabase (ทุกคนเห็นตรงกัน)
   ออฟไลน์ = เก็บในเครื่อง เล่นได้ปกติแต่เห็นแค่ของตัวเอง
   ═══════════════════════════════════════════════════════ */
const SB = {
  ready() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_KEY); },
  head() {
    return {
      "apikey": CFG.SUPABASE_KEY,
      "Authorization": "Bearer " + CFG.SUPABASE_KEY,
      "Content-Type": "application/json"
    };
  },
  async get(query) {
    const res = await fetch(CFG.SUPABASE_URL + "/rest/v1/scores?" + query, { headers: this.head() });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  },
  async post(row) {
    const res = await fetch(CFG.SUPABASE_URL + "/rest/v1/scores", {
      method: "POST",
      headers: Object.assign(this.head(), { "Prefer": "return=minimal" }),
      body: JSON.stringify(row)
    });
    if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()));
  }
};

async function checkNet() {
  const el = $("net");
  if (!SB.ready()) { ONLINE = false; el.textContent = "เก็บในเครื่อง"; el.className = "net off"; return; }
  try {
    await SB.get("select=id&limit=1");
    ONLINE = true; el.textContent = "กระดานกลาง"; el.className = "net on";
  } catch (e) {
    ONLINE = false; el.textContent = "ต่อไม่ได้"; el.className = "net off";
    console.warn("Supabase:", e.message);
  }
}

/* บันทึกผล — ส่งขึ้นกระดานกลางถ้าต่อได้ และเก็บสำเนาในเครื่องเสมอ */
async function submit(entry) {
  const mine = LS.get("scores", []);
  const i = mine.findIndex(e => e.name === entry.name && e.level === entry.level
    && e.mode === entry.mode && (e.code || "") === (entry.code || ""));
  let personalBest = true;
  if (i >= 0) { if (mine[i].score < entry.score) mine[i] = entry; else personalBest = false; }
  else mine.push(entry);
  LS.set("scores", mine);

  if (ONLINE && entry.score > 0) {
    try {
      await SB.post({
        name: entry.name, level: entry.level, mode: entry.mode,
        score: entry.score, correct: entry.correct, asked: entry.asked,
        duel_code: entry.code || null
      });
    } catch (e) { console.warn("ส่งคะแนนไม่สำเร็จ:", e.message); toast("ส่งคะแนนขึ้นกระดานกลางไม่สำเร็จ เก็บไว้ในเครื่องแทน"); }
  }
  return personalBest;
}

/* ดึงกระดาน — คืนค่าดีที่สุดของแต่ละคน สูงสุด 10 อันดับ */
async function fetchBoard(level, mode, code) {
  let rows;
  if (ONLINE) {
    try {
      let q = "select=name,score,correct&level=eq." + level + "&mode=eq." + mode;
      if (mode === "duel" && code) q += "&duel_code=eq." + encodeURIComponent(code);
      q += "&order=score.desc&limit=300";
      rows = await SB.get(q);
    } catch (e) { rows = null; }
  }
  if (!rows) {
    rows = LS.get("scores", []).filter(e => e.level === level && e.mode === mode
      && (mode !== "duel" || !code || e.code === code));
  }
  const best = {};
  rows.forEach(r => { if (!best[r.name] || best[r.name].score < r.score) best[r.name] = r; });
  return Object.values(best).sort((a, b) => b.score - a.score).slice(0, 10);
}

function boardHTML(list, me) {
  if (!list.length) return '<p class="empty">ยังไม่มีใครทำคะแนนไว้ — เป็นคนแรกเลย</p>';
  const medal = ["🥇", "🥈", "🥉"];
  return list.map((e, i) => `<div class="lbrow ${e.name === me ? "me" : ""}">
      <span class="rk">${medal[i] || i + 1}</span>
      <span>${esc(e.name)} <span class="meta">${e.correct} ข้อ</span></span>
      <span class="pts">${num(e.score)}</span>
    </div>`).join("");
}

/* ═══ โหลดคลังคำศัพท์ ═══════════════════════════════════ */
async function loadData() {
  // เวอร์ชันไฟล์เดียว (แชร์ลิงก์) ฝังข้อมูลมาแล้ว ไม่ต้องโหลดเพิ่ม
  if (window.VA_DATA) { Object.assign(DB, window.VA_DATA); return; }
  await Promise.all(CFG.LEVELS.map(async id => {
    try {
      const res = await fetch("data/" + id + ".json", { cache: "no-cache" });
      DB[id] = await res.json();
    } catch (e) {
      DB[id] = { id, label: id, tier: "?", blurb: "โหลดข้อมูลไม่สำเร็จ", target: 1000, words: [] };
      console.warn("โหลด data/" + id + ".json ไม่ได้:", e.message);
    }
  }));
}

/* ═══ สร้างชุดคำถาม ═════════════════════════════════════ */
function buildQueue() {
  const lv = DB[S.level];
  const all = lv.words;
  const pool = S.cat ? all.filter(w => w.cat === S.cat) : all;
  if (pool.length < 4) return false;

  const seed = S.mode === "duel" ? hash(S.level + "|" + S.cat + "|" + S.code)
    : (Math.random() * 4294967296) >>> 0;
  const rand = rng(seed);
  const order = shuffle(pool, rand);
  const limit = S.mode === "duel" ? Math.min(R.duelQuestions, order.length) : order.length;

  S.queue = order.slice(0, limit).map(item => {
    // ตัวเลือกลวง: เอาจากหมวดเดียวกันก่อน ถ้าไม่พอค่อยดึงจากหมวดอื่น
    const sameCat = pool.filter(x => x.cat === item.cat && x.th !== item.th);
    const others = all.filter(x => x.cat !== item.cat && x.th !== item.th);
    let decoys = shuffle(sameCat, rand).slice(0, 3);
    if (decoys.length < 3) decoys = decoys.concat(shuffle(others, rand).slice(0, 3 - decoys.length));
    const rev = OPT.reverse ? rand() < R.reverseChance : false;
    const opts = shuffle([item, ...decoys], rand);
    return { item, rev, opts, answer: opts.indexOf(item) };
  });
  return true;
}

/* ═══ ดำเนินเกม ═════════════════════════════════════════ */
const SCREENS = ["s-home", "s-play", "s-done", "s-set"];
function show(id) {
  SCREENS.forEach(s => $(s).classList.toggle("hide", s !== id));
  window.scrollTo(0, 0);
}

function perQuestionSecs() {
  return S.mode === "survive" ? OPT.perSecs : (S.mode === "duel" ? OPT.perSecs + 2 : OPT.rushSecs);
}

async function begin() {
  S.name = ($("name").value.trim() || "ผู้เล่น").slice(0, 14);
  LS.set("name", S.name);

  S.code = S.mode === "duel" ? ($("duelcode").value.trim().toUpperCase() || randCode()) : "";
  if (S.mode === "duel") $("duelcode").value = S.code;

  if (!buildQueue()) { toast("หมวดนี้มีคำน้อยเกินไป ต้องมีอย่างน้อย 4 คำ"); return; }

  Object.assign(S, { score: 0, correct: 0, asked: 0, streak: 0, bestStreak: 0, missed: [], locked: false, playing: true });
  $("whoname").textContent = S.name;
  $("score").textContent = "0";
  $("streak").classList.add("hide");
  show("s-play");

  if (S.mode === "rush") { S.timeLeft = OPT.rushSecs; startClock(); }
  next();
}

function startClock() {
  clearInterval(S.tick);
  const total = perQuestionSecs();
  paint(S.timeLeft, total);
  S.tick = setInterval(() => {
    S.timeLeft -= 0.1;
    paint(S.timeLeft, total);
    if (S.timeLeft <= 0) {
      clearInterval(S.tick);
      if (S.mode === "rush") finish("หมดเวลา"); else answer(-1);
    }
  }, 100);
}
function paint(left, total) {
  const f = Math.max(0, Math.min(1, left / total));
  const arc = $("arc");
  arc.style.strokeDashoffset = (138.2 * (1 - f)).toFixed(1);
  arc.style.stroke = f < 0.25 ? "var(--brick)" : "var(--gold)";
  $("clock").textContent = Math.max(0, Math.ceil(left));
}

function next() {
  if (!S.playing) return;
  if (!S.queue.length) { finish("เล่นครบทุกคำแล้ว"); return; }
  S.locked = false;
  S.q = S.queue.shift();
  S.qStart = Date.now();
  const { item, rev, opts } = S.q;

  $("tag").textContent = item.cat + (item.pos ? " · " + item.pos : "");
  $("word").textContent = rev ? item.th : item.en;
  $("word").classList.toggle("th", rev);
  $("phon").textContent = rev ? "" : "[ " + item.read + " ]";
  $("say").classList.toggle("hide", rev);
  $("dir").textContent = rev ? "→ เลือกคำภาษาอังกฤษที่ตรงความหมาย" : "→ เลือกความหมายภาษาไทย";

  $("answers").innerHTML = opts.map((o, i) =>
    `<button class="ans" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(rev ? o.en : o.th)}</span></button>`).join("");
  $("answers").querySelectorAll("[data-i]").forEach(b => b.onclick = () => answer(+b.dataset.i));

  $("qcount").textContent = S.mode === "duel" ? `ข้อ ${S.asked + 1}/${R.duelQuestions}` : `${S.asked} ข้อ`;

  if (!rev && OPT.speak) speak(item.en);
  if (S.mode !== "rush") { S.timeLeft = perQuestionSecs(); startClock(); }
}

function answer(pick) {
  if (S.locked) return;
  S.locked = true;
  if (S.mode !== "rush") clearInterval(S.tick);
  S.asked++;

  const right = pick === S.q.answer;
  const btns = $("answers").querySelectorAll(".ans");
  btns.forEach((b, i) => { b.disabled = true; if (i === S.q.answer) b.classList.add("good"); });
  if (!right && pick >= 0) btns[pick].classList.add("bad");

  if (right) {
    S.correct++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    const secs = (Date.now() - S.qStart) / 1000;
    const speedBonus = Math.max(0, Math.round((R.speedWindow - secs) * R.speedBonus));
    const combo = Math.min(R.comboMax, 1 + (S.streak - 1) * R.comboStep);
    const gain = Math.round((R.basePoints + speedBonus) * combo);
    S.score += gain;
    $("score").textContent = num(S.score);
    $("streak").textContent = "🔥 " + S.streak + (combo > 1 ? ` ×${combo.toFixed(1)}` : "");
    $("streak").classList.toggle("hide", S.streak < 2);
    flash("+" + gain, "var(--jade)");
    beep(660, .09); setTimeout(() => beep(880, .09), 90);
  } else {
    S.streak = 0;
    $("streak").classList.add("hide");
    S.missed.push(S.q.item);
    beep(180, .22);
    if (S.mode === "rush") {
      S.timeLeft = Math.max(0.1, S.timeLeft - R.rushPenalty);
      flash("−" + R.rushPenalty + " วิ", "var(--brick)");
    }
  }

  if (S.mode === "survive" && !right) { S.nextT = setTimeout(() => finish(pick < 0 ? "หมดเวลา" : "ตอบผิด"), 1100); return; }
  if (S.mode === "duel" && S.asked >= R.duelQuestions) { S.nextT = setTimeout(() => finish("ครบ " + R.duelQuestions + " ข้อ"), 1100); return; }
  S.nextT = setTimeout(next, right ? 520 : 1050);
}

async function finish(reason) {
  clearInterval(S.tick);
  clearTimeout(S.nextT);
  if (!S.playing) return;
  S.playing = false;

  const lv = DB[S.level];
  const entry = {
    name: S.name, level: S.level, mode: S.mode, code: S.code,
    score: S.score, correct: S.correct, asked: S.asked, at: Date.now()
  };

  $("r-reason").textContent = reason + " · " + lv.label + " · " + MODES[S.mode].short;
  $("r-score").textContent = num(S.score);
  $("r-correct").textContent = S.correct;
  $("r-acc").textContent = S.asked ? Math.round(S.correct / S.asked * 100) + "%" : "0%";
  $("r-streak").textContent = S.bestStreak;

  $("r-duel").classList.toggle("hide", S.mode !== "duel");
  $("r-code").textContent = S.code;

  $("r-miss").classList.toggle("hide", !S.missed.length);
  $("r-misslist").innerHTML = S.missed.slice(0, 12).map(w =>
    `<div class="lbrow"><span class="rk">✕</span><span><b>${esc(w.en)}</b>
      <span class="meta">${esc(w.read)}</span></span><span>${esc(w.th)}</span></div>`).join("");

  $("r-lbhead").textContent = "กระดานคะแนน · " + lv.label + " · " + MODES[S.mode].short
    + (S.mode === "duel" ? " · รหัส " + S.code : "");
  $("r-lblist").innerHTML = '<p class="empty">กำลังโหลด…</p>';
  show("s-done");

  const personalBest = await submit(entry);
  $("r-line").textContent = S.score === 0 ? "ลองใหม่อีกครั้ง"
    : (personalBest ? "🎉 สถิติใหม่ของ " + S.name + "!" : "ยังไม่ชนะสถิติเดิมของตัวเอง สู้ต่อ!");
  $("r-lblist").innerHTML = boardHTML(await fetchBoard(S.level, S.mode, S.code), S.name);
}

/* ═══ เอฟเฟกต์ ══════════════════════════════════════════ */
function flash(text, color) {
  const el = document.createElement("div");
  el.className = "pop"; el.textContent = text; el.style.color = color;
  document.body.appendChild(el); setTimeout(() => el.remove(), 760);
}
let ac = null;
function beep(freq, dur) {
  if (!OPT.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    g.gain.setValueAtTime(.06, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch { }
}
function speak(word) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US"; u.rate = .85;
    speechSynthesis.speak(u);
  } catch { }
}
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2500);
}

/* ═══ หน้าจอหลัก ════════════════════════════════════════ */
function renderLevels() {
  $("levels").innerHTML = CFG.LEVELS.map(id => {
    const lv = DB[id], empty = !lv.words.length;
    return `<button class="lv" data-lv="${id}" aria-pressed="${S.level === id}" ${empty ? "disabled" : ""}>
      <span class="tier">${esc(lv.tier)}</span>
      <span><b>${esc(lv.label)}</b><small>${esc(lv.blurb)}</small></span>
      <span class="count">${empty ? "เร็วๆ นี้" : lv.words.length + " / " + lv.target}</span>
    </button>`;
  }).join("");
  $("levels").querySelectorAll("[data-lv]").forEach(b => b.onclick = () => {
    S.level = b.dataset.lv; S.cat = "";
    LS.set("level", S.level);
    renderLevels(); renderCats(); refreshBoard();
  });
}

function renderCats() {
  const cats = [...new Set(DB[S.level].words.map(w => w.cat))];
  $("cat").innerHTML = '<option value="">ทุกหมวด (' + DB[S.level].words.length + ' คำ)</option>'
    + cats.map(c => {
      const n = DB[S.level].words.filter(w => w.cat === c).length;
      return `<option value="${esc(c)}">${esc(c)} (${n})</option>`;
    }).join("");
  $("cat").value = S.cat;
}

function renderModes() {
  $("modes").innerHTML = Object.entries(MODES).map(([k, m]) =>
    `<button class="chip" data-m="${k}" aria-pressed="${S.mode === k}">${esc(m.label)}</button>`).join("");
  $("modes").querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    S.mode = b.dataset.m; LS.set("mode", S.mode); renderModes(); refreshBoard();
  });
  $("modenote").textContent = MODES[S.mode].note;
  $("duelbox").classList.toggle("hide", S.mode !== "duel");
  if (S.mode === "duel" && !$("duelcode").value) $("duelcode").value = randCode();
}

async function refreshBoard() {
  $("lbtabs").innerHTML = Object.entries(MODES).map(([k, m]) =>
    `<button class="tab" data-t="${k}" aria-pressed="${S.mode === k}">${esc(m.short)}</button>`).join("");
  $("lbtabs").querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
    S.mode = b.dataset.t; renderModes(); refreshBoard();
  });
  const code = S.mode === "duel" ? $("duelcode").value.trim().toUpperCase() : "";
  $("lbwho").textContent = DB[S.level].label + (code ? " · รหัส " + code : "");
  $("lblist").innerHTML = '<p class="empty">กำลังโหลด…</p>';
  $("lblist").innerHTML = boardHTML(await fetchBoard(S.level, S.mode, code), S.name);
}

/* ═══ ตั้งค่า ═══════════════════════════════════════════ */
function applyOpts() {
  document.documentElement.setAttribute("data-size", OPT.size);
  if (OPT.theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", OPT.theme);
  seg("seg-size", OPT.size); seg("seg-theme", OPT.theme);
  seg("seg-rush", String(OPT.rushSecs)); seg("seg-per", String(OPT.perSecs));
  $("sw-sound").setAttribute("aria-pressed", OPT.sound);
  $("sw-rev").setAttribute("aria-pressed", OPT.reverse);
  $("sw-speak").setAttribute("aria-pressed", OPT.speak);
  LS.set("opts", OPT);
}
function seg(id, val) {
  $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === val));
}
function wireSeg(id, key, cast) {
  $(id).querySelectorAll("button").forEach(b => b.onclick = () => {
    OPT[key] = cast ? cast(b.dataset.v) : b.dataset.v; applyOpts();
  });
}
function wireSwitch(id, key) {
  $(id).onclick = () => { OPT[key] = !OPT[key]; applyOpts(); };
}

/* ═══ ต่อสาย ════════════════════════════════════════════ */
$("start").onclick = begin;
$("again").onclick = begin;
$("home").onclick = () => { refreshBoard(); show("s-home"); };
$("quit").onclick = () => finish("จบเกมเอง");
$("newcode").onclick = () => { $("duelcode").value = randCode(); refreshBoard(); };
$("duelcode").oninput = () => refreshBoard();
$("cat").onchange = e => { S.cat = e.target.value; };
$("gear").onclick = () => show("s-set");
$("set-back").onclick = () => show("s-home");
$("say").onclick = () => { if (S.q && !S.q.rev) speak(S.q.item.en); };
$("share").onclick = () => {
  const lv = DB[S.level].label;
  const text = `ท้าดวลคำศัพท์! ระดับ${lv} รหัส ${S.code}\nฉันได้ ${num(S.score)} คะแนน ลองสู้ดู\n${location.href}`;
  if (navigator.share) navigator.share({ text }).catch(() => { });
  else navigator.clipboard.writeText(text).then(() => toast("คัดลอกแล้ว ส่งให้เพื่อนได้เลย"), () => toast("คัดลอกไม่สำเร็จ"));
};

wireSeg("seg-size", "size");
wireSeg("seg-theme", "theme");
wireSeg("seg-rush", "rushSecs", Number);
wireSeg("seg-per", "perSecs", Number);
wireSwitch("sw-sound", "sound");
wireSwitch("sw-rev", "reverse");
wireSwitch("sw-speak", "speak");

document.addEventListener("keydown", e => {
  if ($("s-play").classList.contains("hide")) return;
  if (e.key >= "1" && e.key <= "4") {
    const b = $("answers").querySelector(`[data-i="${+e.key - 1}"]`);
    if (b && !b.disabled) b.click();
  }
});

/* ═══ เริ่มต้น ══════════════════════════════════════════ */
(async function boot() {
  Object.assign(OPT, LS.get("opts", {}));
  applyOpts();

  $("name").value = LS.get("name", "");
  S.name = $("name").value;
  S.level = CFG.LEVELS.includes(LS.get("level", "")) ? LS.get("level") : CFG.LEVELS[0];
  S.mode = MODES[LS.get("mode", "")] ? LS.get("mode") : "rush";

  await loadData();
  if (!DB[S.level].words.length) S.level = CFG.LEVELS.find(id => DB[id].words.length) || CFG.LEVELS[0];

  renderLevels(); renderCats(); renderModes();

  const total = CFG.LEVELS.reduce((n, id) => n + DB[id].words.length, 0);
  $("foot").innerHTML = "คลังคำปัจจุบัน " + num(total) + " คำ · เป้าหมาย 4,000 คำ<br>"
    + (SB.ready() ? "คะแนนขึ้นกระดานกลาง ทุกคนเห็นตรงกัน" : "ยังไม่ได้ตั้งค่ากระดานกลาง — ดู SETUP.md");

  await checkNet();
  refreshBoard();
})();
