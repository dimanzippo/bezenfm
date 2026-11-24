window.Bezen = window.Bezen || {};
Bezen.audio = (function () {
  const audio = new Audio();
  const handlers = {};
  let started = false, ctx = null, analyser = null, freq = null, masterGain = null;
  let beet = null, beetFreq = null;
  let corsMode = true, retryTimer = null, probeTimer = null;
  let playing = false, signal = 0, bassSmooth = 0;
  let lastT = 0;
  let sourceIdx = 0;
  let proxyFail = 0, vol = 1, wantsPlay = false, proxyHadSuccess = false;
  let srcStartT = 0, progressed = false, dataSeen = false, watchdog = null, stallAttempts = 0;
  let gestureArmed = false, blocked = false;
  const STALL_MS = 8000;
  const evLog = [];
  function lg(n) { evLog.push(((Date.now() % 1000000) / 1000).toFixed(1) + " " + n); if (evLog.length > 60) evLog.shift(); }

  const mains = (Bezen.CFG.streamUrls || [Bezen.CFG.streamUrl]).filter((u) => u && /^https?:/i.test(u));
  const streams = mains.map((u) => ({ url: u, kind: "main" }));
  if (Bezen.CFG.backupStreamUrl && /^https?:/i.test(Bezen.CFG.backupStreamUrl)) {
    streams.push({ url: Bezen.CFG.backupStreamUrl, kind: "backup" });
  }
  const BACKUP_IDX = streams.length - 1;
  const isHttp = (u) => /^http:/i.test(u);

  let lastBeatT = -10, bassHitV = 0;
  let bassEma = 0, bassEmaInit = false;
  let agcGain = 1, agcLvl = 0;
  const AGC_TARGET = 0.06;

  function on(evt, cb) { (handlers[evt] = handlers[evt] || []).push(cb); }
  function emit(evt, ...args) { (handlers[evt] || []).forEach((cb) => cb(...args)); }

  function isOnAir() {
    const d = new Date();
    const h = Math.floor((d.getUTCHours() + d.getUTCMinutes() / 60 + Bezen.CFG.broadcastTzOffset + 24) % 24);
    const s = Bezen.CFG.broadcastStart, e = Bezen.CFG.broadcastEnd;
    if (s === e) return true;
    return s < e ? (h >= s && h < e) : (h >= s || h < e);
  }

  audio.preload = "none";
  audio.crossOrigin = "anonymous";

  function useProxyFor(i) {
    const s = streams[i];
    return !!(s && s.kind === "main" && isHttp(s.url) && Bezen.proxyPlayer);
  }

  function applyVolume() {
    audio.volume = vol;
    if (masterGain) masterGain.gain.value = useProxyFor(sourceIdx) ? vol : 1;
  }

  function setSource(i) {
    clearTimeout(retryTimer);
    clearInterval(probeTimer);
    probeTimer = null;
    if (Bezen.proxyPlayer) Bezen.proxyPlayer.stop();
    sourceIdx = Math.max(0, Math.min(streams.length - 1, i));
    proxyFail = 0;
    proxyHadSuccess = false;
    srcStartT = Date.now();
    progressed = false;
    dataSeen = false;
    const s = streams[sourceIdx];
    if (useProxyFor(sourceIdx)) {
      corsMode = true;
      try { audio.pause(); } catch (e) {}
      Bezen.proxyPlayer.play(s.url);
    } else {
      corsMode = true;
      audio.crossOrigin = "anonymous";
      audio.src = s.url;
      audio.load();
      if (wantsPlay) playElement();
    }
    applyVolume();
    armWatchdog();
    lg("set " + sourceIdx + " " + s.url.slice(0, 46));
    emit("source", s.kind);
    if (s.kind === "backup") {
      probeTimer = setInterval(probeMain, Bezen.CFG.probeMs);
    }
  }

  function connectStream() {
    if (!started) return;
    setSource(sourceIdx);
  }

  let probing = false;

  // Звук может не пойти по разным причинам: адрес ретрансляции висит, сервер не отдаёт
  // данные, браузер запретил автоплей. Событие "error" при этом часто не приходит вообще,
  // поэтому следим сами: если за отведённое время из источника не пошёл звук — берём следующий.
  function markProgress() {
    progressed = true;
    stallAttempts = 0;
    blocked = false;
  }

  function markData() {
    dataSeen = true;
  }

  function armWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(() => {
      if (!started || !wantsPlay || playing || progressed) return;
      // Если данные уже пошли, но звук всё не начинается — ждём дольше (поток медленно разгоняется).
      const wait = Math.min(45000, (dataSeen ? 25000 : STALL_MS) + stallAttempts * STALL_MS);
      if (Date.now() - srcStartT < wait) return;
      stallAttempts++;
      lg("wd stall -> next");
      emit("stalling", streams[sourceIdx].url);
      setSource((sourceIdx + 1) % streams.length);
    }, 1200);
  }

  function onPlayRejected(err) {
    if (!err || (err.name !== "NotAllowedError" && err.name !== "SecurityError")) return;
    blocked = true;
    emit("blocked");
    armGestureRetry();
  }

  function playElement() {
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(onPlayRejected);
    return p;
  }

  function armGestureRetry() {
    if (gestureArmed) return;
    gestureArmed = true;
    const go = () => {
      gestureArmed = false;
      window.removeEventListener("pointerdown", go, true);
      window.removeEventListener("keydown", go, true);
      window.removeEventListener("touchstart", go, true);
      if (!wantsPlay) return;
      blocked = false;
      if (ctx && ctx.state === "suspended") ctx.resume();
      srcStartT = Date.now();
      progressed = false;
      playElement();
    };
    window.addEventListener("pointerdown", go, true);
    window.addEventListener("keydown", go, true);
    window.addEventListener("touchstart", go, true);
  }

  async function probeMain() {
    if (probing) return;
    if (sourceIdx !== BACKUP_IDX || !isOnAir()) return;
    probing = true;
    let ok = false;
    try {
      ok = useProxyFor(0) ? await probeHttpMain() : await probeNativeMain();
    } catch (e) {
      ok = false;
    }
    probing = false;
    if (ok && sourceIdx === BACKUP_IDX && isOnAir()) {
      proxyFail = 0;
      setSource(0);
    }
  }

  async function probeHttpMain() {
    const sf = (typeof root !== "undefined" && root && root.superFetch) || window.superFetch;
    if (!sf) return false;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await sf(streams[0].url, { signal: ctrl.signal });
      if (!r.ok || !r.body) return false;
      const reader = r.body.getReader();
      let total = 0;
      while (total < 24000) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
      }
      return total >= 1500;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(to);
      try { ctrl.abort(); } catch (e) {}
    }
  }

  function probeNativeMain() {
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = "auto";
      a.muted = true;
      a.volume = 0;
      let done = false, attempt = 0, t = null;
      const arm = () => {
        clearTimeout(t);
        t = setTimeout(() => finish(false), 8000);
      };
      const finish = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        try { a.pause(); a.removeAttribute("src"); a.load(); } catch (e) {}
        resolve(ok);
      };
      const onErr = () => {
        if (done) return;
        if (attempt === 0) {
          attempt = 1;
          a.crossOrigin = "";
          a.src = streams[0].url;
          a.load();
          a.play().catch(() => {});
          arm();
        } else {
          finish(false);
        }
      };
      a.addEventListener("playing", () => finish(true), { once: true });
      a.addEventListener("canplay", () => finish(true), { once: true });
      a.addEventListener("error", onErr);
      try {
        a.crossOrigin = "anonymous";
        a.src = streams[0].url;
        a.load();
        a.play().catch(() => {});
        arm();
      } catch (e) {
        finish(false);
      }
    });
  }

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      freq = new Uint8Array(analyser.frequencyBinCount);
      masterGain = ctx.createGain();
      analyser.connect(masterGain);
      masterGain.connect(ctx.destination);
      const src = ctx.createMediaElementSource(audio);
      src.connect(analyser);
      beet = ctx.createAnalyser();
      beet.fftSize = 512;
      beet.smoothingTimeConstant = 0;
      beetFreq = new Uint8Array(beet.frequencyBinCount);
      src.connect(beet);
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {
      analyser = null;
    }
    audio.addEventListener("playing", () => { lg("ce:playing"); playing = true; markProgress(); emit("playing"); });
    audio.addEventListener("timeupdate", markProgress);
    audio.addEventListener("pause", () => { lg("ce:pause"); playing = false; emit("pause"); });
    audio.addEventListener("waiting", () => { lg("ce:waiting"); emit("waiting"); });
    audio.addEventListener("stalled", () => lg("ce:stalled"));
    audio.addEventListener("loadedmetadata", () => { lg("ce:loadedmetadata"); markData(); });
    audio.addEventListener("loadeddata", () => { lg("ce:loadeddata"); markData(); });
    audio.addEventListener("canplay", () => { lg("ce:canplay"); markData(); });
    audio.addEventListener("progress", markData);
    audio.addEventListener("canplay", () => {
      if (wantsPlay && !playing) playElement();
    });
    audio.addEventListener("error", onError);
    if (Bezen.proxyPlayer) {
      Bezen.proxyPlayer.on("playing", () => { proxyHadSuccess = true; playing = true; markProgress(); emit("playing"); });
      Bezen.proxyPlayer.on("error", onProxyError);
    }
    setSource(isOnAir() ? 0 : BACKUP_IDX);
  }

  function onProxyError() {
    if (!useProxyFor(sourceIdx)) return;
    proxyFail++;
    if ((!proxyHadSuccess && proxyFail >= 1) || proxyFail >= 3) {
      setSource(BACKUP_IDX);
    }
  }

  function onError() {
    lg("ce:error" + (audio.error ? ":" + audio.error.code : "") + (corsMode ? " cors" : ""));
    if (corsMode) {
      corsMode = false;
      clearTimeout(retryTimer);
      audio.crossOrigin = "";
      audio.src = streams[sourceIdx].url;
      audio.load();
      playElement();
      return;
    }
    playing = false;
    emit("error");
    clearTimeout(retryTimer);
    if (sourceIdx === BACKUP_IDX) {
      retryTimer = setTimeout(connectStream, Bezen.CFG.retryMs);
    } else {
      setSource(Math.min(streams.length - 1, sourceIdx + 1));
    }
  }

  function play() {
    wantsPlay = true;
    if (!started) start();
    if (useProxyFor(sourceIdx) && Bezen.proxyPlayer) Bezen.proxyPlayer.resume();
    blocked = false;
    srcStartT = Date.now();
    progressed = false;
    playElement();
    armWatchdog();
  }
  function pause() {
    wantsPlay = false;
    clearInterval(watchdog);
    watchdog = null;
    if (Bezen.proxyPlayer) Bezen.proxyPlayer.pause();
    audio.pause();
  }
  function retryNow() {
    clearTimeout(retryTimer);
    connectStream();
  }
  function forceMain() {
    if (sourceIdx !== 0) { proxyFail = 0; setSource(0); }
  }
  function isPlaying() {
    return playing;
  }
  function isBlocked() {
    return blocked;
  }
  function debugState() {
    const el = {
      src: String(audio.src || "").slice(0, 70),
      paused: audio.paused, readyState: audio.readyState, networkState: audio.networkState,
      err: audio.error ? audio.error.code : null, crossOrigin: audio.crossOrigin,
      volume: audio.volume, muted: audio.muted, ct: +Number(audio.currentTime || 0).toFixed(1),
    };
    return {
      started, wantsPlay, playing, blocked, progressed, dataSeen, sourceIdx, stallAttempts,
      watchdog: !!watchdog, sinceSrcMs: Date.now() - srcStartT, kind: streams[sourceIdx].kind,
      ctx: ctx ? ctx.state : null, el, events: evLog.slice(-14),
    };
  }

  function currentKind() {
    return streams[sourceIdx].kind;
  }
  function setVolume(v) {
    vol = Math.max(0, Math.min(1, v));
    applyVolume();
  }

  function detectBass(e, t) {
    if (!bassEmaInit) { bassEma = e; bassEmaInit = true; }
    bassEma += (e - bassEma) * 0.22;
    const vel = e - bassEma;
    if (vel > 0.065 && e > 0.2 && (t - lastBeatT) > 0.16) {
      lastBeatT = t;
      const hitV = Math.min(1, (vel * 4.5 + 0.35) * agcGain);
      bassHitV = hitV;
      emit("bass", hitV);
    }
  }

  function frame(t) {
    lastT = t;
    if (analyser && freq) {
      analyser.getByteFrequencyData(freq);
      let s = 0;
      for (let i = 0; i < 44; i++) s += freq[i];
      if (playing) signal = Math.max(0, Math.min(1, signal * 0.92 + (s > 70 ? 0.3 : 0)));
      else signal = 0;
      let lvl = 0;
      for (let i = 0; i < 50; i++) lvl += freq[i];
      lvl = lvl / (50 * 255);
      if (lvl < 0.006) {
        agcLvl = Math.max(0, agcLvl - 0.004);
        agcGain += (1 - agcGain) * 0.02;
      } else {
        agcLvl += (lvl - agcLvl) * (lvl > agcLvl ? 0.4 : 0.025);
        const want = AGC_TARGET / Math.max(agcLvl, 0.0001);
        const clamped = Math.max(0.15, Math.min(1.6, want));
        agcGain += (clamped - agcGain) * (agcGain > clamped ? 0.4 : 0.07);
      }
      if (beet && beetFreq) {
        beet.getByteFrequencyData(beetFreq);
        let be = 0;
        for (let i = 1; i < 10; i++) be += beetFreq[i];
        detectBass(be / (9 * 255), t);
      }
    } else {
      signal = 0;
      const beat = Math.pow(Math.max(0, Math.sin(t * 2.4 - Math.PI / 2)), 2);
      detectBass(playing ? beat * 0.85 : 0.05, t);
    }
    bassHitV = Math.max(0, bassHitV - 0.028);
  }

  function real() {
    return analyser && freq && playing && signal > 0.06;
  }

  function spectrum(N) {
    const out = new Float32Array(N);
    if (real()) {
      for (let i = 0; i < N; i++) {
        const a = Math.pow(i / N, 1.7) * (freq.length - 1);
        const b = Math.max(a + 1, Math.pow((i + 1) / N, 1.7) * (freq.length - 1));
        let m = 0;
        for (let k = Math.floor(a); k < Math.min(freq.length, Math.ceil(b)); k++) {
          if (freq[k] > m) m = freq[k];
        }
        out[i] = Math.min(1, (m / 255) * agcGain);
      }
      return out;
    }
    const beat = Math.pow(Math.max(0, Math.sin(lastT * 2.4 - Math.PI / 2)), 2);
    const live = Math.max(0, Math.min(1, signal * 1.25));
    const amp = 0.05 + 0.62 * live;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const w1 = Math.sin(lastT * (1.1 + f * 2.4) + i * 0.55) * 0.5 + 0.5;
      const w2 = Math.sin(lastT * 0.7 + f * 6.28) * 0.5 + 0.5;
      let v = w1 * w2;
      v += beat * Math.max(0, 1 - f * 3) * 0.65;
      v += (0.2 + 0.3 * f) * w1 * 0.45;
      out[i] = Math.min(1, v * amp + 0.02);
    }
    return out;
  }

  function bass() {
    if (real()) {
      let b = 0;
      for (let i = 1; i < 10; i++) b += freq[i];
      const tgt = Math.min(1, (b / (9 * 255)) * agcGain);
      bassSmooth += (tgt - bassSmooth) * 0.35;
    } else {
      const beat = Math.pow(Math.max(0, Math.sin(lastT * 2.4 - Math.PI / 2)), 2);
      bassSmooth += (((playing && signal > 0.2) ? beat : 0.05) - bassSmooth) * 0.3;
    }
    return Math.max(0, Math.min(1, bassSmooth));
  }

  function context() { return ctx; }
  function analyserNode() { return analyser; }
  function beatNode() { return beet; }
  function time() { return lastT; }
  function bassHitValue() { return bassHitV; }

  return {
    start, play, pause, retryNow, forceMain, isPlaying, isBlocked, debugState, currentKind, setVolume,
    on, frame, spectrum, bass, context, analyserNode, beatNode, time, bassHitValue,
  };
})();
