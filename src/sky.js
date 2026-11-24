window.Bezen = window.Bezen || {};
Bezen.sky = (function () {
  let cv, ctx, W, H, DPR;
  let stars = [], meteors = [], dust = [];
  let nextMeteor = 2;
  const moonX = 0.82, moonY = 0.15;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    if (!cv.clientWidth || !cv.clientHeight) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.floor(cv.clientWidth * DPR);
    cv.height = Math.floor(cv.clientHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    W = cv.clientWidth;
    H = cv.clientHeight;
    buildStars();
    buildDust();
  }

  function buildDust() {
    dust = [];
    const count = Math.min(150, Math.floor((W * H) / 10000));
    for (let i = 0; i < count; i++) {
      dust.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.4, 1.9),
        base: rand(0.3, 1),
        tw: rand(0.6, 2.6),
        ph: rand(0, 6.28),
        vy: rand(0.04, 0.22),
        hue: Math.random() < 0.3 ? rand(260, 330) : Math.random() < 0.35 ? rand(185, 235) : 210,
      });
    }
  }

  function bandSum(sp, a, b) {
    let s = 0;
    for (let i = a; i < b; i++) s += sp[i];
    return s / (b - a);
  }

  function drawNebula(t, low, mid, high) {
    const pulse = Math.min(1, low * 1.1 + mid * 0.7);
    const clouds = [
      { cx: 0.24, cy: 0.26, r: 0.62, hue: 262, drift: 0.11, core: 0.30 },
      { cx: 0.78, cy: 0.22, r: 0.60, hue: 322, drift: 0.09, core: 0.28 },
      { cx: 0.5,  cy: 0.55, r: 0.72, hue: 205, drift: 0.13, core: 0.34 },
      { cx: 0.10, cy: 0.68, r: 0.45, hue: 280, drift: 0.08, core: 0.22 },
      { cx: 0.92, cy: 0.14, r: 0.44, hue: 328, drift: 0.10, core: 0.24 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const c of clouds) {
      const cx = W * (c.cx + 0.07 * Math.sin(t * c.drift + c.hue));
      const cy = H * (c.cy + 0.05 * Math.cos(t * c.drift * 0.8 + c.hue * 0.5));
      const R = Math.max(W, H) * c.r * (0.8 + 0.6 * pulse);
      const a = 0.16 + 0.4 * pulse;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, "hsla(" + c.hue + ", 96%, 66%, " + a.toFixed(3) + ")");
      g.addColorStop(0.4, "hsla(" + (c.hue + 24) + ", 96%, 50%, " + (a * 0.52).toFixed(3) + ")");
      g.addColorStop(1, "hsla(" + c.hue + ", 96%, 28%, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 6.2832);
      ctx.fill();
      const Rc = R * c.core;
      const gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rc);
      gc.addColorStop(0, "hsla(" + ((c.hue + 30) % 360) + ", 100%, 84%, " + (a * 0.5).toFixed(3) + ")");
      gc.addColorStop(1, "hsla(" + c.hue + ", 96%, 60%, 0)");
      ctx.fillStyle = gc;
      ctx.beginPath();
      ctx.arc(cx, cy, Rc, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    for (const c of clouds) {
      const cx = W * (c.cx + 0.07 * Math.sin(t * c.drift + c.hue));
      const cy = H * (c.cy + 0.05 * Math.cos(t * c.drift * 0.8 + c.hue * 0.5));
      const R = Math.max(W, H) * c.r * (0.8 + 0.6 * pulse);
      const d = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
      d.addColorStop(0, "rgba(2,3,12,0)");
      d.addColorStop(0.72, "rgba(1,2,9," + (0.30 + 0.10 * pulse).toFixed(3) + ")");
      d.addColorStop(1, "rgba(1,2,9,0)");
      ctx.fillStyle = d;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  let auroraEnvs = [0, 0, 0, 0];
  function drawAurora(t, low, mid, high) {
    const glows = [
      { x: 0.25, y: 0.14, rx: 0.55, ry: 0.20, hue: 150, drift: 0.06, wL: 0.45, wM: 0.9, wH: 0.2 },
      { x: 0.55, y: 0.09, rx: 0.65, ry: 0.18, hue: 258, drift: 0.08, wL: 1.0, wM: 0.35, wH: 0.1 },
      { x: 0.83, y: 0.22, rx: 0.45, ry: 0.16, hue: 320, drift: 0.05, wL: 0.3, wM: 0.85, wH: 0.55 },
      { x: 0.40, y: 0.30, rx: 0.50, ry: 0.15, hue: 130, drift: 0.07, wL: 0.7, wM: 0.5, wH: 0.35 },
    ];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let gi = 0; gi < glows.length; gi++) {
      const g = glows[gi];
      const raw = Math.max(0, Math.min(1, g.wL * low + g.wM * mid + g.wH * high));
      const target = Math.min(1, raw * 2.6);
      const prev = auroraEnvs[gi];
      auroraEnvs[gi] = prev + (target - prev) * (target > prev ? 0.95 : 0.25);
      const e = auroraEnvs[gi];
      const cx = W * (g.x + 0.06 * Math.sin(t * g.drift + g.hue));
      const cy = H * g.y + H * 0.03 * Math.sin(t * 0.12 + g.hue);
      const R = Math.max(W, H) * g.rx * (0.66 + 0.7 * e);
      const Ry = R * (g.ry / g.rx) * (0.66 + 0.7 * e);
      const shim = 0.85 + 0.15 * Math.sin(t * 1.8 + g.hue);
      const a = (0.04 + 0.62 * e) * shim;
      if (a < 0.02) continue;
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, "hsla(" + g.hue + ", 90%, 74%, " + a.toFixed(3) + ")");
      gr.addColorStop(0.5, "hsla(" + g.hue + ", 88%, 60%, " + (a * 0.55).toFixed(3) + ")");
      gr.addColorStop(1, "hsla(" + g.hue + ", 88%, 42%, 0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, Ry, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDust(t, mid, bass) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of dust) {
      p.y -= p.vy * (1 + bass * 2.4);
      if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
      p.x += Math.sin(t * p.tw + p.ph) * 0.14;
      const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.ph);
      const a = p.base * (0.35 + 0.65 * tw) * (0.6 + mid * 0.8);
      if (a < 0.03) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = "hsl(" + p.hue + ", 80%, 84%)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function buildStars() {
    const count = Math.min(340, Math.floor((W * H) / 3800));
    stars = [];
    for (let i = 0; i < count; i++) {
      const r = rand(0.4, 1.7);
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.92,
        r,
        base: rand(0.35, 1),
        speed: rand(0.5, 2.4),
        phase: rand(0, 6.28),
        hue: Math.random() < 0.14 ? rand(30, 60) : Math.random() < 0.3 ? rand(200, 260) : 215,
        big: r > 1.45 && Math.random() < 0.5,
      });
    }
  }

  function spawnMeteor(multi) {
    const n = multi ? Math.floor(rand(1, 3)) : 1;
    for (let k = 0; k < n; k++) {
      meteors.push({
        x: rand(0, W * 0.85),
        y: rand(-H * 0.06, H * 0.28),
        vx: rand(W * 0.00022, W * 0.0005),
        vy: rand(H * 0.00013, H * 0.0003),
        life: 0,
        max: rand(45, 95),
        len: rand(70, 210),
        hue: Math.random() < 0.35 ? rand(165, 215) : rand(35, 60),
      });
    }
  }

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function drawOrb(cx, cy, r, alpha, t) {
    const hue = (t * 5) % 360;
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, "hsla(" + hue.toFixed(0) + ", 92%, 62%, " + alpha.toFixed(3) + ")");
    gr.addColorStop(0.45, "hsla(" + hue.toFixed(0) + ", 90%, 50%, " + (alpha * 0.55).toFixed(3) + ")");
    gr.addColorStop(1, "hsla(" + hue.toFixed(0) + ", 90%, 28%, 0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fill();
  }

  function drawMoon() {
    const cx = W * moonX, cy = H * moonY, r = Math.max(10, Math.min(W, H) * 0.021);
    const halo = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 6.5);
    halo.addColorStop(0, "rgba(190, 205, 255, 0.30)");
    halo.addColorStop(1, "rgba(190, 205, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - r * 6.5, cy - r * 6.5, r * 13, r * 13);
    const mg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
    mg.addColorStop(0, "#ffffff");
    mg.addColorStop(0.75, "#e2e9ff");
    mg.addColorStop(1, "#b7c4ee");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "rgba(176, 186, 228, 0.38)";
    const craters = [[-0.3, -0.15, 0.17], [0.22, -0.26, 0.11], [0.16, 0.3, 0.15], [-0.12, 0.36, 0.09]];
    for (const c of craters) {
      ctx.beginPath();
      ctx.arc(cx + c[0] * r, cy + c[1] * r, c[2] * r, 0, 6.2832);
      ctx.fill();
    }
  }

  function draw(t, beat) {
    const bass = beat || 0;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#02040f");
    g.addColorStop(0.45, "#070d28");
    g.addColorStop(0.8, "#120d34");
    g.addColorStop(1, "#160f3c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sp = Bezen.audio.spectrum(48);
    const bLow = bandSum(sp, 0, 5);
    const bMid = bandSum(sp, 5, 22);
    const bHigh = bandSum(sp, 22, 48);
    drawNebula(t, bLow, bMid, bHigh);
    drawAurora(t, bLow, bMid, bHigh);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawOrb(W * 0.5, H * 0.44, W * (0.66 + bass * 0.16), 0.16 + bass * 0.18, t);
    drawOrb(W * 0.24, H * 0.72, W * (0.57 + bass * 0.13), 0.14 + bass * 0.15, t + 2.6);
    drawOrb(W * 0.82, H * 0.28, W * (0.41 + bass * 0.12), 0.12 + bass * 0.14, t + 5.1);
    ctx.restore();

    drawMoon();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of stars) {
      const a = s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
      if (a < 0.03) continue;
      ctx.globalAlpha = Math.min(1, a * 0.95);
      ctx.fillStyle = "hsl(" + s.hue + ", 55%, 90%)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      ctx.fill();
      if (s.big) {
        ctx.globalAlpha = a * 0.5;
        ctx.fillRect(s.x - s.r * 4, s.y - 0.5, s.r * 8, 1);
        ctx.fillRect(s.x - 0.5, s.y - s.r * 4, 1, s.r * 8);
      }
    }

    if (t > nextMeteor) {
      spawnMeteor(bass > 0.55);
      nextMeteor = t + rand(2.5, 7.5);
    }
    meteors = meteors.filter((m) => m.life < m.max);
    for (const m of meteors) {
      m.life++;
      const k = m.life / m.max;
      const x = m.x + m.vx * m.life, y = m.y + m.vy * m.life;
      const tx = x - m.vx * m.len, ty = y - m.vy * m.len;
      const alpha = Math.sin(Math.min(k, 1) * Math.PI) * 0.95;
      const lg = ctx.createLinearGradient(x, y, tx, ty);
      lg.addColorStop(0, "hsla(" + m.hue + ", 100%, 92%, " + alpha.toFixed(3) + ")");
      lg.addColorStop(1, "hsla(230, 60%, 60%, 0)");
      ctx.strokeStyle = lg;
      ctx.lineCap = "round";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, 6.2832);
      ctx.fill();
    }
    drawDust(t, bMid, bass);
    ctx.restore();
  }

  return { init, draw };
})();
