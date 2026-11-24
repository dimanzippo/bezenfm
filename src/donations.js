window.Bezen = window.Bezen || {};
Bezen.donations = (function () {
  const handlers = {};
  function on(e, cb) { (handlers[e] = handlers[e] || []).push(cb); }
  function emit(e, ...a) { (handlers[e] || []).forEach((cb) => cb(...a)); }

  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  let cfg = {
    url: "https://api.vkdonate.ru",
    key: "",
    count: 20,
    refreshMs: 60000,
    appUrl: "",
    donorNames: {},
    openTall: 760,
  };
  let els = {};
  let timer = null, running = false, started = false;
  let lastMaxId = null, firstLoad = true, sig = "";
  let items = [];

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function parseMoscow(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || ""));
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
  }

  function fmtWhen(d) {
    const p = parseMoscow(d.date);
    const ts = Number(d.ts) || 0;
    if (ts) {
      const sec = Math.max(0, Math.floor(Date.now() / 1000) - ts);
      if (sec < 60) return "только что";
      if (sec < 3600) { const n = Math.floor(sec / 60); return n + " " + plural(n, "минуту", "минуты", "минут") + " назад"; }
      if (sec < 86400) { const n = Math.floor(sec / 3600); return n + " " + plural(n, "час", "часа", "часов") + " назад"; }
    }
    if (!p) return "";
    const now = new Date();
    const base = p.d + " " + MONTHS[Math.max(0, Math.min(11, p.mo - 1))];
    const time = String(p.h).padStart(2, "0") + ":" + String(p.mi).padStart(2, "0");
    return base + (p.y !== now.getFullYear() ? " " + p.y : "") + ", " + time;
  }

  function fmtSum(n) {
    const v = Math.round(Number(n) || 0);
    return v.toLocaleString("ru-RU") + " \u20bd";
  }

  function normalize(raw) {
    return (raw || []).map((d) => ({
      id: Number(d.id) || 0,
      uid: Number(d.uid) || 0,
      sum: Number(d.sum) || 0,
      msg: String(d.msg == null ? "" : d.msg).trim(),
      date: String(d.date || ""),
      ts: Number(d.ts) || 0,
      anon: Number(d.anon) === 1,
    })).filter((d) => d.id);
  }

  function buildItem(d, isNew) {
    const li = document.createElement("li");
    li.className = "don" + (isNew ? " new" : "");

    const sum = document.createElement("span");
    sum.className = "donSum";
    sum.textContent = fmtSum(d.sum);
    li.appendChild(sum);

    const body = document.createElement("div");
    body.className = "donBody";

    const msg = document.createElement("div");
    if (d.msg) {
      msg.className = "donMsg";
      msg.textContent = "\u00ab" + d.msg + "\u00bb";
    } else {
      msg.className = "donMsg none";
      msg.textContent = "без сообщения";
    }
    body.appendChild(msg);

    const meta = document.createElement("div");
    meta.className = "donMeta";
    const when = document.createElement("span");
    when.textContent = fmtWhen(d);
    meta.appendChild(when);
    if (d.anon) {
      const a = document.createElement("span");
      a.className = "anon";
      a.textContent = "аноним";
      meta.appendChild(a);
    } else if (d.uid) {
      const name = cfg.donorNames[String(d.uid)] || "";
      const a = document.createElement("a");
      a.href = "https://vk.com/id" + d.uid;
      a.target = "_blank";
      a.rel = "noopener noreferrer nofollow";
      if (name) {
        a.className = "donName";
        a.textContent = name;
        a.title = "профиль в ВК";
      } else {
        a.textContent = "профиль в ВК";
      }
      meta.appendChild(a);
    }
    body.appendChild(meta);
    li.appendChild(body);
    return li;
  }

  function renderStat(total, sum) {
    if (!els.stat) return;
    if (!total) { els.stat.textContent = "пока пусто"; return; }
    let s = total + " " + plural(total, "привет", "привета", "приветов");
    if (sum != null) s += " · " + fmtSum(sum);
    els.stat.textContent = s;
  }

  function render(newIds) {
    if (!els.list) return;
    els.list.textContent = "";
    if (!items.length) {
      if (els.empty) els.empty.hidden = false;
      return;
    }
    if (els.empty) els.empty.hidden = true;
    for (const d of items) els.list.appendChild(buildItem(d, newIds && newIds.has(d.id)));
    if (newIds && newIds.size && els.body) els.body.scrollTop = 0;
  }

  async function request(action, extra) {
    const q = new URLSearchParams(Object.assign({ key: cfg.key, action }, extra || {}));
    const u = cfg.url + (cfg.url.indexOf("?") >= 0 ? "&" : "?") + q.toString();
    let data = null, err = null;
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) data = await r.json();
      else err = new Error("http " + r.status);
    } catch (e) { err = e; }
    if (!data) {
      const sf = (typeof root !== "undefined" && root && root.superFetch) || window.superFetch;
      if (sf) {
        try { const r = await sf(u); data = await r.json(); } catch (e) { err = e; }
      }
    }
    if (!data || data.success === false || !Array.isArray(data.donates)) {
      throw new Error("donate api: " + (err ? err.message || err : "bad response"));
    }
    return data;
  }

  async function load() {
    const data = await request("donates", { count: cfg.count, sort: "date", order: "desc" });
    const raw = data.donates || [];
    const total = Number(data.count) || raw.length;
    const gotAll = total <= raw.length;
    const list = normalize(raw).filter((d) => {
      const src = raw.find((r) => Number(r.id) === d.id);
      return !src || Number(src.visible) !== 0;
    });
    const sum = gotAll ? list.reduce((a, d) => a + d.sum, 0) : null;
    const shown = gotAll ? list.length : total;

    const nextSig = list.map((d) => d.id + ":" + d.sum + ":" + d.msg + ":" + d.anon).join("|");
    const maxId = list.reduce((a, d) => Math.max(a, d.id), 0);
    let newIds = null;
    if (!firstLoad && lastMaxId != null && maxId > lastMaxId) {
      newIds = new Set(list.filter((d) => d.id > lastMaxId).map((d) => d.id));
    }
    firstLoad = false;
    lastMaxId = maxId;
    items = list;
    if (newIds || nextSig !== sig) { sig = nextSig; render(newIds); }
    if (newIds && newIds.size) emit("new", list.filter((d) => newIds.has(d.id)).length);
    renderStat(shown, sum);
    if (newIds && newIds.size) flashHeader();
  }

  let flashTimer = null;
  function flashHeader() {
    if (!els.root) return;
    els.root.classList.remove("flash");
    void els.root.offsetWidth;
    els.root.classList.add("flash");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => els.root && els.root.classList.remove("flash"), 2400);
  }

  async function tick() {
    timer = null;
    if (!started) return;
    if (running) return;
    running = true;
    try { await load(); } catch (e) { emit("error", e); }
    running = false;
    schedule(document.hidden ? Math.max(cfg.refreshMs, 120000) : cfg.refreshMs);
  }

  function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }
  function refresh() { if (running) return; clearTimeout(timer); timer = setTimeout(tick, 0); }

  function setOpen(open) {
    if (!els.root) return;
    els.root.classList.toggle("closed", !open);
    if (els.toggle) els.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    try { localStorage.setItem("bezen_dons_open", open ? "1" : "0"); } catch (e) {}
  }

  function init(opts) {
    opts = opts || {};
    cfg = {
      url: opts.url || cfg.url,
      key: opts.key || "",
      count: Math.max(1, Math.min(50, parseInt(opts.count, 10) || 20)),
      refreshMs: Math.max(15000, parseInt(opts.refreshMs, 10) || 60000),
      appUrl: opts.appUrl || "",
      donorNames: opts.donorNames && typeof opts.donorNames === "object" ? opts.donorNames : {},
      openTall: parseInt(opts.openTall, 10) || 760,
    };
    els = {
      root: document.getElementById("donsCtn"),
      toggle: document.getElementById("donsToggle"),
      stat: document.getElementById("donsStat"),
      body: document.getElementById("donsBody"),
      list: document.getElementById("donsList"),
      empty: document.getElementById("donsEmpty"),
      donateLink: document.getElementById("donsSend"),
    };
    if (els.toggle) {
      els.toggle.addEventListener("click", () => setOpen(els.root.classList.contains("closed")));
    }
    if (els.donateLink && cfg.appUrl) els.donateLink.href = cfg.appUrl;
    let saved = null;
    try { saved = localStorage.getItem("bezen_dons_open"); } catch (e) {}
    setOpen(saved === null ? window.innerHeight >= cfg.openTall : saved === "1");
    renderStat(0, null);
    if (els.donateLink) els.donateLink.hidden = !cfg.appUrl;
    return !!cfg.key;
  }

  function start() {
    if (started || !cfg.key) return;
    started = true;
    if (!els.root) return;
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    tick();
  }

  return { init, start, refresh, setOpen, on, items: () => items };
})();
