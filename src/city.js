window.Bezen = window.Bezen || {};
Bezen.city = (function () {
  let cv, ctx, W, H, DPR;
  let buildings = [], waves = [];
  let nextEmit = 1;
  let shockBorn = -10, shockStr = 0;
  let mastGlow = 0.3;

  const GY = 0.94;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function bandSum(sp, a, b) {
    let s = 0;
    for (let i = a; i < b; i++) s += sp[i];
    return s / (b - a);
  }

  function resize() {
    if (!cv.clientWidth || !cv.clientHeight) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(cv.clientWidth * DPR);
    cv.height = Math.floor(cv.clientHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = cv.clientWidth;
    H = cv.clientHeight;
    build();
  }

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    if (Bezen.audio && Bezen.audio.on) {
      Bezen.audio.on("bass", (s) => {
        const t = Bezen.audio.time ? Bezen.audio.time() : 0;
        shockBorn = t;
        const sv = Math.max(0, Math.min(1, s || 0.5));
        shockStr = Math.max(0, Math.min(1, 0.55 + sv * 0.6));
        waves.push({ born: t, max: 1.0, hue: 296, power: Math.max(0, Math.min(1, 0.6 + shockStr * 0.5)) });
      });
    }
  }

  function det(seed) {
    const v = Math.abs(Math.sin(seed * 127.1 + 311.7));
    return v - Math.floor(v);
  }

  function build() {
    buildings = [];
    const addHouse = (x0n, x1n, hn, opts) => {
      opts = opts || {};
      const x0 = W * x0n, x1 = W * x1n, h = H * hn, y = H * GY - h;
      const color = opts.color || "#0a0f2e";
      const win = [];
      const lit = opts.lit !== undefined ? opts.lit : 0.45;
      const hue = opts.hue !== undefined ? opts.hue : 42;
      const cols = Math.max(1, Math.round((x1 - x0) / (W * 0.016)));
      const rows = Math.max(1, Math.round(h / (H * 0.03)));
      const cw = (x1 - x0) / (cols + 1), ch = h / (rows + 1);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const seed = x0n * 31.7 + c * 7.3 + r * 13.9;
          if (det(seed) < lit) {
            win.push({
              x: x0 + cw * (c + 0.5) - cw * 0.15,
              y: y + ch * (r + 0.5) - ch * 0.16,
              w: Math.max(2, cw * 0.3),
              h: Math.max(2, ch * 0.34),
              hue: hue + det(seed + 3) * 22 - 11,
              flick: det(seed + 5) < 0.12 ? 0.5 + det(seed + 6) * 1.5 : 0,
              ph: det(seed + 7) * 6.28,
            });
          }
        }
      }
      buildings.push({ kind: "house", x0, x1, y, h, color, roof: opts.roof || "flat", win });
    };

    addHouse(0.005, 0.10, 0.13, { roof: "gable" });
    addHouse(0.095, 0.16, 0.10, { color: "#0b1033", lit: 0.38, hue: 38 });
    addHouse(0.30, 0.40, 0.12, { roof: "gable", lit: 0.5, hue: 46 });
    addHouse(0.385, 0.435, 0.09, { color: "#110f38", lit: 0.42, hue: 30 });
    addHouse(0.635, 0.70, 0.115, { roof: "gable", lit: 0.48 });
    addHouse(0.72, 0.80, 0.095, { lit: 0.4, hue: 35 });
    addHouse(0.79, 0.86, 0.12, { roof: "gable", color: "#0b1033", lit: 0.45, hue: 44 });
    addHouse(0.885, 0.985, 0.105, { roof: "gable", lit: 0.42, hue: 40 });
    addHouse(0.90, 0.955, 0.14, { color: "#0e0f36", lit: 0.5, hue: 33 });
  }

  function drawHouse(b, t) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x0, b.y, b.x1 - b.x0, b.h);
    if (b.roof === "gable") {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x0 - 1, b.y);
      ctx.lineTo((b.x0 + b.x1) / 2, b.y - b.h * 0.26);
      ctx.lineTo(b.x1 + 1, b.y);
      ctx.closePath();
      ctx.fill();
    }
    for (const w of b.win) {
      let a = 1;
      if (w.flick) a = 0.55 + 0.45 * Math.sin(t * w.flick + w.ph);
      ctx.fillStyle = "hsla(" + w.hue.toFixed(0) + ", 100%, 62%, " + (0.78 * a).toFixed(3) + ")";
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  function drawTrees() {
    const P = [[0.155, 0.9], [0.20, 1.35], [0.318, 0.85], [0.428, 1.15], [0.605, 0.7], [0.688, 0.95], [0.90, 1.05], [0.945, 0.78]];
    const gh = H * GY;
    for (const p of P) {
      const x = W * p[0], s = p[1];
      const w = H * 0.03 * s, h = H * 0.16 * s;
      const base = gh - 2;
      ctx.fillStyle = "#0c1233";
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x - w, base);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0e1436";
      ctx.beginPath();
      ctx.moveTo(x, base - h * 1.5);
      ctx.lineTo(x - w * 0.72, base - h * 0.55);
      ctx.lineTo(x + w * 0.72, base - h * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#080b22";
      ctx.fillRect(x - 1.5, base - 3, 3, 3);
    }
  }

  function drawChurch(t) {
    const gh = H * GY;
    const x0 = W * 0.225, w = W * 0.034;
    const baseH = H * 0.15, y = gh - baseH;
    ctx.fillStyle = "#0b1030";
    ctx.fillRect(x0, y, w, baseH);
    ctx.fillStyle = "#0c1134";
    ctx.beginPath();
    ctx.moveTo(x0 - w * 0.12, y);
    ctx.lineTo(x0 + w * 0.5, y - baseH * 0.5);
    ctx.lineTo(x0 + w * 1.12, y);
    ctx.closePath();
    ctx.fill();
    const dx = x0 + w * 0.5, dy = y - baseH * 0.5;
    ctx.fillStyle = "#0d1236";
    ctx.fillRect(dx - w * 0.14, dy - baseH * 0.17, w * 0.28, baseH * 0.17);
    ctx.beginPath();
    ctx.arc(dx, dy - baseH * 0.17, w * 0.24, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(dx - w * 0.2, dy - baseH * 0.17);
    ctx.quadraticCurveTo(dx - w * 0.24, dy - baseH * 0.5, dx, dy - baseH * 0.42);
    ctx.quadraticCurveTo(dx + w * 0.24, dy - baseH * 0.5, dx + w * 0.2, dy - baseH * 0.17);
    ctx.fill();
    ctx.strokeStyle = "#1a2350";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(dx, dy - baseH * 0.42);
    ctx.lineTo(dx, dy - baseH * 0.56);
    ctx.moveTo(dx - w * 0.07, dy - baseH * 0.52);
    ctx.lineTo(dx + w * 0.07, dy - baseH * 0.52);
    ctx.stroke();
    const wa = 0.55 + 0.45 * Math.sin(t * 1.1);
    ctx.fillStyle = "rgba(255, 190, 110, " + (0.7 * wa).toFixed(3) + ")";
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.5 - w * 0.09, y + baseH * 0.3);
    ctx.lineTo(x0 + w * 0.5 - w * 0.09, y + baseH * 0.42);
    ctx.arc(x0 + w * 0.5, y + baseH * 0.42, w * 0.09, Math.PI, 0);
    ctx.lineTo(x0 + w * 0.5 + w * 0.09, y + baseH * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  function drawStation(t) {
    const gh = H * GY;
    const x0 = W * 0.44, x1 = W * 0.63;
    const h = H * 0.13, y = gh - h;
    ctx.fillStyle = "#160f30";
    ctx.fillRect(x0, y, x1 - x0, h);
    const cx = (x0 + x1) / 2, cw = (x1 - x0) * 0.36;
    const chh = H * 0.225, cy = gh - chh;
    ctx.fillStyle = "#1a1138";
    ctx.fillRect(cx - cw / 2, cy, cw, chh);
    ctx.fillStyle = "#0d1236";
    ctx.beginPath();
    ctx.moveTo(x0 - 2, y);
    ctx.lineTo(x0 + 4, y - 7);
    ctx.lineTo(x1 - 4, y - 7);
    ctx.lineTo(x1 + 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2 - 2, cy);
    ctx.lineTo(cx - cw / 2 + 3, cy - 9);
    ctx.lineTo(cx + cw / 2 - 3, cy - 9);
    ctx.lineTo(cx + cw / 2 + 2, cy);
    ctx.closePath();
    ctx.fill();
    const arcw = cw * 0.12, arch = chh * 0.5, awy = cy + chh * 0.07;
    for (let i = -1; i <= 1; i++) {
      const awx = cx + i * cw * 0.22;
      const a = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 2);
      ctx.fillStyle = "hsla(42, 100%, 66%, " + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(awx - arcw / 2, awy + arch * 0.9);
      ctx.lineTo(awx - arcw / 2, awy + arch * 0.5);
      ctx.arc(awx, awy + arch * 0.5, arcw / 2, Math.PI, 0);
      ctx.lineTo(awx + arcw / 2, awy + arch * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#e9edff";
    ctx.beginPath();
    ctx.arc(cx, cy - 5, Math.max(2, H * 0.007), 0, 6.2832);
    ctx.fill();
    const ww = (x1 - x0) * 0.052, wh = h * 0.24;
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 2; r++) {
        const seed = c * 3.1 + r * 17.7;
        const x = x0 + (c + 0.5) * (x1 - x0) / 7 - ww / 2;
        const wy = y + (r + 0.55) * (h / 2.2);
        const lit = det(seed);
        if (lit < 0.55) {
          const a = 0.55 + 0.45 * Math.sin(t * (0.7 + lit) + lit * 30);
          ctx.fillStyle = "hsla(40, 100%, 62%, " + (0.75 * a).toFixed(3) + ")";
          ctx.fillRect(x, wy, ww, wh);
        }
      }
    }
  }

  function drawWaterTower() {
    const gh = H * GY;
    const x = W * 0.655, tw = W * 0.024;
    const th = H * 0.20, topY = gh - th;
    ctx.strokeStyle = "#0d1236";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - tw * 0.5, topY + th * 0.45);
    ctx.lineTo(x - tw * 0.9, gh);
    ctx.moveTo(x + tw * 0.5, topY + th * 0.45);
    ctx.lineTo(x + tw * 0.9, gh);
    ctx.moveTo(x - tw * 0.9, gh);
    ctx.lineTo(x + tw * 0.9, gh);
    ctx.stroke();
    ctx.fillStyle = "#0f1538";
    ctx.fillRect(x - tw, topY + th * 0.45, tw * 2, th * 0.55);
    ctx.fillStyle = "#0d1236";
    ctx.beginPath();
    ctx.moveTo(x - tw * 1.1, topY + th * 0.45);
    ctx.lineTo(x, topY + th * 0.28);
    ctx.lineTo(x + tw * 1.1, topY + th * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "hsla(200, 100%, 72%, 0.9)";
    ctx.fillRect(x - tw * 0.3, topY + th * 0.52, tw * 0.6, th * 0.16);
  }

  function drawSilos() {
    const gh = H * GY;
    const x0 = W * 0.70, r = W * 0.0105, n = 4, gap = W * 0.005;
    const sh = H * 0.26, topY = gh - sh;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (r * 2 + gap) + r;
      ctx.fillStyle = "#0e1334";
      ctx.fillRect(cx - r, topY, r * 2, sh);
      ctx.fillStyle = "#141b42";
      ctx.beginPath();
      ctx.ellipse(cx, topY, r, H * 0.008, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "#0a0f2c";
      ctx.beginPath();
      ctx.ellipse(cx, topY + sh, r, H * 0.006, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "hsla(18, 100%, 60%, 0.85)";
      ctx.fillRect(cx - r * 0.5, topY - H * 0.012, r, H * 0.01);
    }
  }

  function drawLamps(t) {
    const gh = H * GY;
    const ls = [[0.582, 1], [0.865, 0.82]];
    for (const l of ls) {
      const x = W * l[0], h = H * 0.085 * l[1], y = gh - h;
      ctx.strokeStyle = "#0d1236";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, gh);
      ctx.stroke();
      ctx.fillStyle = "#1c2450";
      ctx.fillRect(x - 4, y, 8, 4);
      const a = 0.22 + 0.05 * Math.sin(t * 1.6 + x);
      const g = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, H * 0.14 * l[1]);
      g.addColorStop(0, "rgba(255, 205, 140, " + a.toFixed(3) + ")");
      g.addColorStop(1, "rgba(255, 205, 140, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y - 6, H * 0.14 * l[1], 0, 6.2832);
      ctx.fill();
    }
  }

  function drawMast(t, low, mid, high) {
    const gh = H * GY;
    const mx = W * 0.845, topY = gh - H * 0.60;
    const hill = ctx.createRadialGradient(mx, gh, 2, mx, gh, W * 0.03);
    hill.addColorStop(0, "rgba(22, 28, 74, 0.9)");
    hill.addColorStop(1, "rgba(22, 28, 74, 0)");
    ctx.fillStyle = hill;
    ctx.beginPath();
    ctx.ellipse(mx, gh, W * 0.03, H * 0.015, 0, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = "#101735";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx - 6, gh);
    ctx.lineTo(mx - 1.4, topY);
    ctx.moveTo(mx + 6, gh);
    ctx.lineTo(mx + 1.4, topY);
    ctx.stroke();
    const steps = 15;
    const dh = (gh - topY) / steps;
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      const yy = gh - dh * i;
      const s = 1 - k;
      const xl = mx - 6 * s, xr = mx + 6 * s;
      ctx.beginPath();
      ctx.moveTo(xl, yy);
      ctx.lineTo(xr, yy);
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(xl, yy);
        ctx.lineTo(xr, yy - dh);
        ctx.stroke();
      }
    }
    const ay = gh - dh * 10;
    ctx.beginPath();
    ctx.moveTo(mx - W * 0.021, ay);
    ctx.lineTo(mx + W * 0.021, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, ay);
    ctx.lineTo(mx, ay - H * 0.02);
    ctx.stroke();
    const ba = 0.65 + 0.35 * Math.sin(t * 4.2);
    const sinceShock = t - shockBorn;
    const flash = sinceShock >= 0 && sinceShock < 0.4 ? (1 - sinceShock / 0.4) * shockStr * 0.6 : 0;
    const tgt = Math.min(1, 0.2 + low * 0.55 + mid * 0.18);
    mastGlow += (tgt - mastGlow) * 0.05;
    const glow = Math.min(1, mastGlow + flash);
    const br = H * 0.03 * (0.82 + glow * 0.5);
    const bg = ctx.createRadialGradient(mx, topY, 1, mx, topY, br);
    bg.addColorStop(0, "rgba(255, 60, 80, " + (0.24 + 0.4 * ba + glow * 0.26).toFixed(3) + ")");
    bg.addColorStop(1, "rgba(255, 60, 80, 0)");
    ctx.fillStyle = bg;
    ctx.fillRect(mx - br, topY - br, br * 2, br * 2);
    ctx.fillStyle = "rgba(255, 95, 105, " + (0.5 + 0.28 * ba + glow * 0.26).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(mx, topY, 2 + glow * 1.4, 0, 6.2832);
    ctx.fill();
    const by = gh - dh * 5.2;
    const bw = Math.max(80, W * 0.052);
    ctx.fillStyle = "rgba(9, 12, 34, 0.94)";
    ctx.fillRect(mx - bw / 2, by - 9, bw, 18);
    ctx.strokeStyle = "rgba(124, 92, 255, " + (0.5 + glow * 0.3).toFixed(3) + ")";
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - bw / 2, by - 9, bw, 18);
    ctx.fillStyle = "rgba(240, 240, 255, " + (0.82 + 0.18 * mid + glow * 0.22).toFixed(3) + ")";
    ctx.font = "600 " + Math.max(9, H * 0.018).toFixed(1) + "px Montserrat, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BEZEN FM", mx, by + 0.5);
  }

  function drawWaves(t, low, mid, high) {
    const gh = H * GY;
    const mx = W * 0.845, topY = gh - H * 0.60;
    const energy = Math.max(0.35, Math.min(1, 0.08 + low * 0.85 + mid * 0.3));
    if (t > nextEmit) {
      waves.push({
        born: t,
        max: 1.2 + (1 - energy) * 0.8,
        hue: 262 + high * 60,
        power: Math.max(0, Math.min(1, 0.3 + energy * 0.5)),
      });
      nextEmit = t + 0.28 + 0.72 * (1 - energy);
    }
    waves = waves.filter((w) => t - w.born < w.max);

    const topGap = Math.max(24, topY);
    const maxR = topGap * 0.98;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const w of waves) {
      const k = (t - w.born) / w.max;
      const ease = 1 - Math.pow(1 - k, 1.8);
      const live = Math.pow(1 - k, 1.5);
      const R = Math.max(0.5, ease * maxR * (0.58 + w.power * 0.4 + low * 0.12));
      const fadeTop = Math.max(0, Math.min(1, (maxR - R) / (maxR * 0.3)));
      const a = Math.min(0.62, live * (0.24 + w.power * 0.38) * (0.9 + low * 0.5) * fadeTop);
      if (a < 0.008) continue;
      const hue = Math.max(0, Math.min(360, w.hue + ease * 26));
      ctx.strokeStyle = "hsla(" + hue.toFixed(0) + ", 95%, 64%, " + a.toFixed(3) + ")";
      ctx.lineWidth = 1.8 + w.power * 2 + mid * 0.8;
      ctx.shadowColor = "hsla(" + hue.toFixed(0) + ", 95%, 60%, " + (a * 0.7).toFixed(3) + ")";
      ctx.shadowBlur = 4 + w.power * 8 + mid * 4;
      ctx.beginPath();
      ctx.arc(mx, topY, R, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.2 + w.power * 1.2;
      ctx.beginPath();
      ctx.arc(mx, topY, R * 0.8, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const sinceShock = t - shockBorn;
    if (sinceShock >= 0 && sinceShock < 0.6) {
      const k = sinceShock / 0.6;
      const R = Math.max(0.5, (0.08 + k * 0.92) * maxR);
      const fadeTop = Math.max(0, Math.min(1, (maxR - R) / (maxR * 0.3)));
      const a = Math.pow(1 - k, 1.3) * (0.28 + 0.3 * shockStr) * (0.4 + 0.6 * fadeTop);
      const hue = Math.max(0, Math.min(360, 262 + high * 60 + k * 34));
      ctx.strokeStyle = "hsla(" + hue.toFixed(0) + ", 95%, 66%, " + a.toFixed(3) + ")";
      ctx.lineWidth = 1.6 + shockStr * 1.8;
      ctx.shadowColor = "hsla(" + hue.toFixed(0) + ", 95%, 62%, " + (a * 0.8).toFixed(3) + ")";
      ctx.shadowBlur = 8 + shockStr * 10;
      ctx.beginPath();
      ctx.arc(mx, topY, R, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1 + shockStr * 1;
      ctx.beginPath();
      ctx.arc(mx, topY, R * 0.8, 0, 6.2832);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function draw(t, beat) {
    const sp = Bezen.audio.spectrum(48);
    const bLow = bandSum(sp, 0, 5);
    const bMid = bandSum(sp, 5, 22);
    const bHigh = bandSum(sp, 22, 48);
    ctx.clearRect(0, 0, W, H);
    const gh = H * GY;
    const gg = ctx.createLinearGradient(0, gh, 0, H);
    gg.addColorStop(0, "#0a0e2c");
    gg.addColorStop(1, "#05081c");
    ctx.fillStyle = gg;
    ctx.fillRect(0, gh, W, H - gh);

    const haze = ctx.createLinearGradient(0, gh - H * 0.18, 0, gh);
    haze.addColorStop(0, "rgba(255, 150, 80, 0)");
    haze.addColorStop(1, "rgba(255, 150, 80, " + (0.10 + beat * 0.06).toFixed(3) + ")");
    ctx.fillStyle = haze;
    ctx.fillRect(0, gh - H * 0.18, W, H * 0.18);

    drawTrees();
    for (const b of buildings) drawHouse(b, t);
    drawChurch(t);
    drawStation(t);
    drawWaterTower();
    drawSilos();
    drawLamps(t);
    drawMast(t, bLow, bMid, bHigh);
    drawWaves(t, bLow, bMid, bHigh);
  }

  return { init, draw };
})();
