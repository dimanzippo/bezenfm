(function () {
  const CFG = Bezen.CFG;
  const $ = (id) => document.getElementById(id);

  Bezen.sky.init($("skyCanvas"));
  Bezen.city.init($("cityCanvas"));

  document.querySelectorAll("[data-cfg]").forEach((el) => {
    const k = el.getAttribute("data-cfg");
    if (CFG[k]) el.textContent = CFG[k];
  });
  document.title = CFG.stationName + " — " + CFG.tagline + " — слушать онлайн";

  const intro = $("intro"), startBtn = $("startBtn"), playBtn = $("playBtn");
  const badge = $("onairBadge"), badgeText = $("onairText");
  const statusLine = $("statusLine"), scheduleLine = $("scheduleLine"), volInput = $("volInput"), volBtn = $("volBtn");

  const nowPlaying = Bezen.nowPlaying;

  const slogans = (() => {
    try {
      if (typeof root !== "undefined" && root && root.slogans && root.slogans.selectAll) {
        return root.slogans.selectAll.map((n) => String(n.evaluateItem).trim());
      }
    } catch (e) {}
    try {
      if (window.slogans && window.slogans.selectAll) {
        return window.slogans.selectAll.map((n) => String(n.evaluateItem));
      }
    } catch (e) {}
    return [
      "Прямой эфир из Безенчука",
      "Радио доброй земли",
      "Голос города на волжских просторах",
      "Первая и единственная",
      "Слушай родное",
      "Волна Безенчука",
    ];
  })();
  nowPlaying.init({
    mainUrls: CFG.nowPlayingUrls,
    backupUrl: CFG.nowPlayingBackupUrl,
    pollMs: CFG.nowPlayingPollMs,
    slogans,
    kindOf: () => Bezen.audio.currentKind(),
  });

  Bezen.donations.init({
    url: CFG.donateUrl,
    key: CFG.donateKey,
    count: CFG.donateCount,
    refreshMs: CFG.donateRefreshMs,
    appUrl: CFG.donateAppUrl,
    donorNames: CFG.donorNames,
  });
  Bezen.donations.start();
  // Тихий прескан основного потока: к моменту нажатия play уже знаем,
  // какой источник включать, и резерв не пробивается ни на секунду.
  try { Bezen.audio.prescan(); } catch (e) {}

  let lastVol = 85;
  let vol = parseFloat(localStorage.getItem("bezen_vol") || "85");
  if (!isFinite(vol)) vol = 85;
  Bezen.audio.setVolume(vol / 100);
  volInput.value = vol;
  volInput.addEventListener("input", onVol);
  volInput.addEventListener("change", onVol);
  function onVol() {
    vol = +volInput.value;
    Bezen.audio.setVolume(vol / 100);
    try { localStorage.setItem("bezen_vol", String(vol)); } catch (e) {}
  }
  volBtn.addEventListener("click", () => {
    if (vol > 0) { lastVol = vol; vol = 0; }
    else { vol = lastVol || 85; }
    volInput.value = vol;
    Bezen.audio.setVolume(vol / 100);
    localStorage.setItem("bezen_vol", String(vol));
  });

  let started = false;
  startBtn.addEventListener("click", () => {
    if (started) return;
    started = true;
    Bezen.audio.play();
    statusLine.textContent = "подключаюсь к потоку…";
    intro.classList.add("done");
    setTimeout(() => (intro.hidden = true), 900);
    nowPlaying.start();
    startStatus();
  });

  playBtn.addEventListener("click", () => {
    if (!started) { startBtn.click(); return; }
    if (Bezen.audio.isPlaying()) Bezen.audio.pause();
    else Bezen.audio.play();
  });

  function setBadge(mode) {
    badge.classList.remove("live", "conn", "wait", "off");
    if (mode === "live") {
      badge.classList.add("live");
      badgeText.textContent = "В ЭФИРЕ";
    } else if (mode === "conn") {
      badge.classList.add("conn");
      badgeText.textContent = "ПОДКЛЮЧЕНИЕ";
    } else if (mode === "backup") {
      badge.classList.add("conn");
      badgeText.textContent = "РЕЗЕРВ";
    } else if (mode === "wait") {
      badge.classList.add("wait");
      badgeText.textContent = "ПАУЗА";
    } else {
      badge.classList.add("off");
      badgeText.textContent = "НЕТ СИГНАЛА";
    }
  }
  setBadge("off");

  const fmtHour = (h) => String(h).padStart(2, "0") + ":00";
  const schedText = "В эфире ежедневно с " + fmtHour(CFG.broadcastStart) + " до " + fmtHour(CFG.broadcastEnd);
  const schedBack = CFG.stationName + " сейчас не в эфире · вернёмся в " + fmtHour(CFG.broadcastStart) + " · резервный поток";

  function setSourceUI(kind) {
    nowPlaying.setFallback(kind === "main" ? "Прямой эфир — " + CFG.stationName : "Резервный поток · Radio Record");
    if (kind === "main") {
      setBadge("live");
      scheduleLine.textContent = schedText;
    } else {
      setBadge("backup");
      scheduleLine.textContent = schedBack;
    }
  }

  Bezen.audio.on("source", (kind) => {
    if (Bezen.audio.isPlaying()) setSourceUI(kind);
    else setBadge("conn");
    nowPlaying.onSourceChange();
  });
  Bezen.audio.on("blocked", () => {
    setBadge("conn");
    statusLine.textContent = "браузер ждёт нажатия — ткните в любое место страницы";
  });
  Bezen.audio.on("stalling", () => {
    if (Bezen.audio.isPlaying()) return;
    setBadge("conn");
    statusLine.textContent = "поток не отвечает — пробую другой адрес…";
  });
  Bezen.audio.on("playing", () => {
    document.body.classList.add("playing");
    setSourceUI(Bezen.audio.currentKind());
    statusLine.textContent = "";
  });
  Bezen.audio.on("pause", () => {
    document.body.classList.remove("playing");
    if (!started) return;
    setBadge("wait");
    statusLine.textContent = "на паузе — нажмите play";
  });
  Bezen.audio.on("waiting", () => {
    if (Bezen.audio.isPlaying()) setBadge("conn");
  });
  Bezen.audio.on("error", () => {
    document.body.classList.remove("playing");
    setBadge("off");
    statusLine.textContent = "нет сигнала — повторяю подключение…";
  });

  let online = false;

  function startStatus() {
    if (CFG.statusUrl) {
      poll();
      setInterval(poll, CFG.statusPollMs);
    }
  }

  async function poll() {
    try {
      const r = await fetch(CFG.statusUrl, { cache: "no-store" });
      if (!r.ok) throw new Error("status " + r.status);
      const j = await r.json();
      online = !!j.on_air;
      if (j.title && j.title !== CFG.stationName) nowPlaying.setStatusTitle(j.title);
      statusLine.textContent = (j.listeners ? "сейчас слушают: " + j.listeners : "нет слушателей") + (online ? "" : " · ждём источник");
      if (online) Bezen.audio.forceMain();
      if (online && !Bezen.audio.isPlaying()) Bezen.audio.retryNow();
      if (!Bezen.audio.isPlaying()) setBadge(online ? "wait" : "off");
    } catch (e) {
      if (!Bezen.audio.isPlaying()) {
        setBadge("off");
        statusLine.textContent = "нет связи со станцией";
      }
    }
  }

  function frame(ms) {
    const t = ms / 1000;
    Bezen.audio.frame(t);
    const beat = Bezen.audio.bass();
    Bezen.sky.draw(t, beat);
    Bezen.city.draw(t, beat);
    document.documentElement.style.setProperty("--beat", beat.toFixed(3));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
