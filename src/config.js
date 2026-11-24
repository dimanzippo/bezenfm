window.Bezen = window.Bezen || {};
Bezen.CFG = (function () {
  const clean = (v) => {
    if (typeof v !== "string") return v;
    v = v.trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).trim();
    return v;
  };
  const fromRoot = (name) => {
    try {
      if (typeof root !== "undefined" && root && typeof root[name] !== "undefined") {
        return clean(String(root[name]));
      }
    } catch (e) {}
    return undefined;
  };
  const pick = (winKey, dflt) => {
    const v = fromRoot(winKey);
    if (v) return v;
    return typeof window[winKey] === "string" && window[winKey].trim() ? window[winKey].trim() : dflt;
  };
  const pickList = (winKey) => {
    try {
      if (typeof root !== "undefined" && root && root[winKey] && root[winKey].selectAll) {
        return root[winKey].selectAll.map((n) => clean(String(n.evaluateItem))).filter(Boolean);
      }
    } catch (e) {}
    // standalone-сборка без движка Perchance: разрешаем обычные массивы в window
    try {
      const w = typeof window !== "undefined" ? window[winKey] : null;
      if (Array.isArray(w)) return w.map((v) => clean(String(v))).filter(Boolean);
    } catch (e) {}
    return [];
  };
  const parseHour = (v) => {
    const n = parseInt(v, 10);
    if (!isFinite(n)) return 10;
    return ((n % 24) + 24) % 24;
  };
  const parseTz = (v) => {
    const n = parseInt(v, 10);
    if (!isFinite(n)) return 4;
    return Math.max(-12, Math.min(14, n));
  };
  const streamList = (function () {
    const extra = pickList("streamUrls");
    const single = pick("streamUrl", "http://bezenfm.ddns.net:8000/");
    const list = (extra.length ? extra : [single]).filter((u) => /^https?:/i.test(u));
    return list.length ? list : ["http://bezenfm.ddns.net:8000/"];
  })();
  const backupUrl = pick("backupStreamUrl", "https://radiorecord.hostingradio.ru/200096.aacp");
  return {
    stationName: pick("stationName", "BEZEN FM"),
    tagline: pick("stationTagline", "Первая радиостанция Безенчука"),
    cityName: pick("cityName", "Безенчук"),
    regionName: pick("regionName", "Самарская область"),
    streamUrl: pick("streamUrl", "http://bezenfm.ddns.net:8000/"),
    streamUrls: streamList,
    statusUrl: pick("statusUrl", ""),
    backupStreamUrl: backupUrl,
    nowPlayingUrls: (function () {
      const explicit = pickList("nowPlayingUrls").filter((u) => /^https:/i.test(u));
      if (explicit.length) return explicit;
      return streamList.filter((u) => /^https:/i.test(u));
    })(),
    nowPlayingBackupUrl: (function () {
      const explicit = pick("nowPlayingBackupUrl", "");
      if (/^https:/i.test(explicit)) return explicit;
      return /^https:/i.test(backupUrl) ? backupUrl : "";
    })(),
    nowPlayingPollMs: Math.max(5000, parseInt(fromRoot("nowPlayingPollMs") || "20000", 10) || 20000),
    donateKey: pick("donateKey", ""),
    donateUrl: pick("donateUrl", "https://api.vkdonate.ru"),
    donateCount: Math.max(1, Math.min(50, parseInt(fromRoot("donateCount") || "20", 10) || 20)),
    donateRefreshMs: Math.max(15000, parseInt(fromRoot("donateRefreshMs") || "60000", 10) || 60000),
    donateAppUrl: pick("donateAppUrl", ""),
    donorNames: (function () {
      const src = (typeof window !== "undefined" && window.BEZEN_DONORS) || null;
      const out = {};
      if (src && typeof src === "object") {
        for (const k in src) {
          if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
          const uid = String(k).trim();
          const name = clean(String(src[k]));
          if (uid && name) out[uid] = name;
        }
      }
      return out;
    })(),
    broadcastStart: parseHour(fromRoot("broadcastStart") || "10"),
    broadcastEnd: parseHour(fromRoot("broadcastEnd") || "23"),
    broadcastTzOffset: parseTz(fromRoot("broadcastTzOffset") || "4"),
    retryMs: 9000,
    statusPollMs: 5000,
    probeMs: parseInt(fromRoot("probeMs") || "45000", 10) || 45000,
  };
})();
