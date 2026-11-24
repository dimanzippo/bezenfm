window.Bezen = window.Bezen || {};
Bezen.proxyPlayer = (function () {
  const handlers = {};
  let url = null, running = false, paused = false, playing = false;
  let gen = 0, currentSrc = null, prevEnd = 0;

  function on(evt, cb) { (handlers[evt] = handlers[evt] || []).push(cb); }
  function emit(evt, ...a) { (handlers[evt] || []).forEach((cb) => cb(...a)); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function stopSrc(s) {
    if (!s) return;
    clearInterval(s._guard);
    try { s.onended = null; } catch (e) {}
    try { s.stop(); } catch (e) {}
    try { s.disconnect(); } catch (e) {}
  }

  function stop() {
    gen++;
    running = false;
    playing = false;
    stopSrc(currentSrc);
    currentSrc = null;
    prevEnd = 0;
  }

  function play(u) {
    stop();
    url = u;
    running = true;
    paused = false;
    pump();
  }

  function pause() {
    paused = true;
    playing = false;
    stopSrc(currentSrc);
    currentSrc = null;
    prevEnd = 0;
  }

  function resume() {
    if (!running) {
      if (url) { running = true; paused = false; pump(); }
      return;
    }
    paused = false;
    pump();
  }

  function isPlaying() { return playing; }

  async function pump() {
    const myGen = gen;
    while (running && myGen === gen) {
      if (paused) { playing = false; await sleep(120); continue; }
      const ctx = Bezen.audio.context();
      const analyser = Bezen.audio.analyserNode();
      const beet = Bezen.audio.beatNode ? Bezen.audio.beatNode() : null;
      if (!ctx) { emit("error"); await sleep(2000); continue; }
      let ab;
      try {
        ab = await fetchChunk(url, myGen);
      } catch (e) {
        if (myGen !== gen || !running) break;
        playing = false;
        emit("error");
        await sleep(2500);
        continue;
      }
      if (myGen !== gen || !running || paused) break;
      let buf;
      try {
        buf = await ctx.decodeAudioData(ab.slice(0));
      } catch (e) {
        await sleep(300);
        continue;
      }
      if (myGen !== gen || !running || paused) break;
      if (!playing) { playing = true; emit("playing"); }
      await playBuffer(ctx, analyser, beet, buf, myGen);
    }
    if (myGen === gen) playing = false;
  }

  async function fetchChunk(u, myGen) {
    const sf = (typeof root !== "undefined" && root && root.superFetch) || window.superFetch;
    if (!sf) throw new Error("no superFetch");
    const ctrl = new AbortController();
    const respPromise = sf(u, { signal: ctrl.signal });
    const connTimeout = setTimeout(() => ctrl.abort(), 7000);
    const r = await respPromise;
    clearTimeout(connTimeout);
    if (!r.ok || !r.body) throw new Error("status " + (r.status || "?"));
    const reader = r.body.getReader();
    const parts = [];
    let total = 0;
    const target = 150000;
    while (total < target) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      total += value.length;
      if (myGen !== gen || !running || paused) break;
    }
    try { ctrl.abort(); } catch (e) {}
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out.buffer;
  }

  function playBuffer(ctx, analyser, beet, buf, myGen) {
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(analyser);
      if (beet) src.connect(beet);
      const start = Math.max(ctx.currentTime + 0.03, prevEnd - 0.04);
      src.start(start);
      prevEnd = start + buf.duration;
      currentSrc = src;
      const finish = () => {
        if (currentSrc === src) currentSrc = null;
        clearInterval(src._guard);
        try { src.disconnect(); } catch (e) {}
        resolve();
      };
      src.onended = finish;
      src._guard = setInterval(() => {
        if (myGen !== gen || !running || paused) { stopSrc(src); finish(); }
      }, 250);
    });
  }

  return { play, stop, pause, resume, isPlaying, on };
})();
