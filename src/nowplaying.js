window.Bezen = window.Bezen || {};
Bezen.nowPlaying = (function () {
  const handlers = {};
  function on(e, cb) { (handlers[e] = handlers[e] || []).push(cb); }
  function emit(e, ...a) { (handlers[e] || []).forEach((cb) => cb(...a)); }

  const READ_TIMEOUT_MS = 12000;
  const MAX_READ_BYTES = 600000;
  const CARRY_BYTES = 2048;
  const STALE_FAILURES = 5;

  let cfg = { mainUrls: [], backupUrl: "", pollMs: 20000, slogans: [] };
  let kindOf = () => "main";

  let el = null, inner = null;
  let track = null;
  let statusTitle = "";
  let fallbackTitle = "";
  let sloganIdx = 0;
  let started = false;
  let pollTimer = null, sloganTimer = null, visibilityBound = false;
  let failures = 0;
  let lastSig = "";

  function cleanTitle(s) {
    s = String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]+/g, " ");
    s = s.replace(/\s{2,}/g, " ").trim();
    if (s.length > 160) s = s.slice(0, 160).trim();
    return s;
  }

  const NEEDLE = new Uint8Array([83, 116, 114, 101, 97, 109, 84, 105, 116, 108, 101, 61, 39]);

  function decodeBytes(bytes) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch (e) {}
    try { return new TextDecoder("windows-1251").decode(bytes); } catch (e) {}
    return "";
  }

  function concatBytes(a, b) {
    if (!a || !a.length) return b;
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  function scanIcy(buf) {
    let found = null;
    for (let s = 1; s + NEEDLE.length + 1 < buf.length; s++) {
      if (buf[s] !== NEEDLE[0]) continue;
      let ok = true;
      for (let k = 1; k < NEEDLE.length; k++) { if (buf[s + k] !== NEEDLE[k]) { ok = false; break; } }
      if (!ok) continue;
      const from = s + NEEDLE.length;
      let close = -1;
      for (let j = from; j + 1 < buf.length; j++) {
        if (buf[j] === 39 && buf[j + 1] === 59) { close = j; break; }
      }
      if (close < 0) continue;
      if (buf[s - 1] !== Math.ceil((close - s + 2) / 16)) continue;
      found = buf.slice(from, close);
    }
    return found;
  }

  async function readTitle(url) {
    const sf = (typeof root !== "undefined" && root && root.superFetch) || window.superFetch;
    if (!sf) return null;
    const ctrl = new AbortController();
    let timedOut = false;
    const to = setTimeout(() => { timedOut = true; ctrl.abort(); }, READ_TIMEOUT_MS);
    let reader = null;
    try {
      const r = await sf(url, { signal: ctrl.signal, headers: { "Icy-MetaData": "1" } });
      if (!r.ok || !r.body) return null;
      reader = r.body.getReader();
      let carry = null, total = 0, found = null;
      while (total < MAX_READ_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        const buf = concatBytes(carry, value);
        found = scanIcy(buf);
        if (found) return found;
        carry = buf.slice(Math.max(0, buf.length - CARRY_BYTES));
      }
      return null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(to);
      const rd = reader;
      reader = null;
      if (rd) {
        rd.cancel().then(
          () => { if (!timedOut) { try { ctrl.abort(); } catch (e) {} } },
          () => { if (!timedOut) { try { ctrl.abort(); } catch (e) {} } }
        ).catch(() => {});
      } else if (!timedOut) {
        try { ctrl.abort(); } catch (e) {}
      }
    }
  }

  function split(raw) {
    const m = raw.match(/^(.{1,80}?)\s[-–—]\s(.{1,140})$/);
    if (m) return { raw, artist: m[1].trim(), song: m[2].trim() };
    return { raw, artist: "", song: raw };
  }

  function urlsFor() {
    if (kindOf() === "main") return cfg.mainUrls;
    return cfg.backupUrl ? [cfg.backupUrl] : [];
  }

  async function poll() {
    const urls = urlsFor();
    for (let i = 0; i < urls.length; i++) {
      const raw = await readTitle(urls[i]);
      if (raw === null) continue;
      const t = cleanTitle(decodeBytes(raw));
      if (!t) break;
      failures = 0;
      if (!track || track.raw.toLowerCase() !== t.toLowerCase()) {
        track = split(t);
        emit("track", track);
      }
      render();
      return;
    }
    failures++;
    if (failures >= STALE_FAILURES && track) { track = null; emit("track", null); }
    render();
  }

  let polling = false;

  async function loop() {
    pollTimer = null;
    if (!started) return;
    if (polling) return;
    polling = true;
    try { await poll(); } catch (e) {}
    polling = false;
    let ms = backoffMs();
    if (document.hidden) ms = Math.max(ms, 6000);
    schedule(ms);
  }

  function backoffMs() {
    if (!failures) return cfg.pollMs;
    if (failures === 1) return 6000;
    return Math.min(cfg.pollMs * (failures - 1) + 6000, 90000);
  }

  function schedule(ms) { clearTimeout(pollTimer); pollTimer = setTimeout(loop, ms); }
  function kick(ms) { if (polling) return; clearTimeout(pollTimer); pollTimer = setTimeout(loop, ms || 0); }

  function measure() {
    if (!el || !inner) return;
    el.classList.remove("scrolling");
    el.style.removeProperty("--npDist");
    const over = inner.scrollWidth - el.clientWidth;
    if (over > 10) {
      el.style.setProperty("--npDist", -over - 6 + "px");
      el.style.setProperty("--npDur", Math.max(4, Math.min(22, (over + 60) / 26)).toFixed(1) + "s");
      void el.offsetWidth;
      el.classList.add("scrolling");
    }
  }

  function nodesFor(t) {
    const frag = document.createDocumentFragment();
    if (t.artist) {
      const a = document.createElement("span");
      a.className = "npArtist";
      a.textContent = t.artist;
      const s = document.createElement("span");
      s.className = "npSep";
      s.textContent = " — ";
      const b = document.createElement("span");
      b.className = "npSong";
      b.textContent = t.song;
      frag.appendChild(a); frag.appendChild(s); frag.appendChild(b);
    } else {
      const b = document.createElement("span");
      b.className = "npSong";
      b.textContent = t.song || t.raw || "";
      frag.appendChild(b);
    }
    return frag;
  }

  function apply(sig, t, isTrack) {
    if (!inner || sig === lastSig) return;
    lastSig = sig;
    inner.textContent = "";
    inner.appendChild(nodesFor(t));
    el.setAttribute("title", inner.textContent);
    el.classList.toggle("npTrack", !!isTrack);
    el.classList.remove("npIn");
    void el.offsetWidth;
    el.classList.add("npIn");
    requestAnimationFrame(measure);
  }

  function render() {
    if (!el || !inner) return;
    if (track) return apply("t:" + track.raw, track, true);
    if (statusTitle) return apply("s:" + statusTitle, split(statusTitle), true);
    if (fallbackTitle) return apply("f:" + fallbackTitle, { raw: fallbackTitle, artist: "", song: fallbackTitle }, false);
    const s = cfg.slogans.length ? cfg.slogans[sloganIdx % cfg.slogans.length] : "";
    if (s) apply("g:" + s, { raw: s, artist: "", song: s }, false);
  }

  function refresh() { kick(0); }

  function onSourceChange() {
    if (track) { track = null; emit("track", null); }
    lastSig = "";
    render();
    kick(120);
  }

  function setStatusTitle(t) {
    t = cleanTitle(t);
    if (t === statusTitle) return;
    statusTitle = t;
    render();
  }

  function setFallback(t) {
    t = cleanTitle(t);
    if (t === fallbackTitle) return;
    fallbackTitle = t;
    render();
  }

  function init(opts) {
    opts = opts || {};
    cfg = {
      mainUrls: (opts.mainUrls || []).filter((u) => /^https:/i.test(u)),
      backupUrl: /^https:/i.test(opts.backupUrl || "") ? opts.backupUrl : "",
      pollMs: Math.max(10000, parseInt(opts.pollMs, 10) || 20000),
      slogans: opts.slogans || cfg.slogans,
    };
    if (typeof opts.kindOf === "function") kindOf = opts.kindOf;
    el = document.getElementById("nowEl");
    inner = document.getElementById("npInner");
  }

  function start() {
    if (started) return;
    started = true;
    if (!el) el = document.getElementById("nowEl");
    if (!inner) inner = document.getElementById("npInner");
    if (!visibilityBound) {
      visibilityBound = true;
      document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(200); });
    }
    clearInterval(sloganTimer);
    sloganTimer = setInterval(() => {
      if (!track && !statusTitle && !fallbackTitle && !document.hidden) { sloganIdx++; render(); }
    }, 9000);
    render();
    kick(0);
  }

  function current() { return track; }

  return { init, start, refresh, onSourceChange, setStatusTitle, setFallback, current, on };
})();
