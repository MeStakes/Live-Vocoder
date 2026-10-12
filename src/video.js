// Il canvas della polaroid, che è anche il video della Registrazione: draw() del prototipo pannello-suono (a0270c0)
// identico, con camera, mani e livello della voce veri al posto di quelli simulati (spec §5).
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const css = getComputedStyle(document.documentElement);
const C = Object.fromEntries(['rosa','rosa-chiaro','viola','viola-luce','prugna','prugna-2','crema','lilla'].map(k => [k, css.getPropertyValue('--' + k).trim()]));
const rgba = (hex, a) => `rgba(${[1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
const rnd = i => { const v = Math.sin(i * 127.1) * 43758.5453; return v - Math.floor(v); };
const GLITTER = Array.from({length: 36}, (_, i) => ({x: rnd(i), y: rnd(i + 99) * .8, s: .4 + rnd(i + 7) * .8, p: rnd(i + 3) * 6.28, v: 1 + rnd(i + 11) * 2}));
// ponytail: quanto copre il velo del Filtro rosa sopra la camera vera; si regola a occhio sul video di Keopees.
const VELO = .45;
// ponytail: RMS della voce che dà all'onda il respiro pieno; si regola a occhio cantando.
const RMS_PIENO = .15;

function star(x, cx, cy, r) {
  x.beginPath(); x.moveTo(cx, cy - r);
  x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill();
}
function heart(x, cx, cy, r) {
  x.beginPath(); x.moveTo(cx, cy + r * .9);
  x.bezierCurveTo(cx - r * 1.6, cy - r * .2, cx - r * .6, cy - r * 1.3, cx, cy - r * .45);
  x.bezierCurveTo(cx + r * .6, cy - r * 1.3, cx + r * 1.6, cy - r * .2, cx, cy + r * .9);
  x.fill(); x.stroke();
}
function drawHand(x, P, m, t, glow, raised) {
  x.lineCap = 'round'; x.strokeStyle = C.crema; x.lineWidth = m * .011;
  x.shadowColor = glow; x.shadowBlur = m * .035;
  x.beginPath(); BONES.forEach(([a, b]) => { x.moveTo(...P[a]); x.lineTo(...P[b]); }); x.stroke();
  x.shadowBlur = 0; x.lineWidth = m * .004;
  const BEAD = [C.rosa, C.lilla, C.crema, C['viola-luce']];
  P.forEach((p, j) => {
    const f = [4, 8, 12, 16, 20].indexOf(j);
    if (f >= 0 && raised(f)) {
      x.strokeStyle = C.crema; x.fillStyle = glow; heart(x, p[0], p[1], m * .028);
      x.fillStyle = C.crema;
      for (const k of [0, 2.1, 4.2]) star(x, p[0] + Math.cos(t * 2 + k) * m * .05, p[1] + Math.sin(t * 2 + k) * m * .05, m * .011);
      return;
    }
    x.strokeStyle = C.prugna; x.fillStyle = BEAD[j % 4];
    x.beginPath(); x.arc(p[0], p[1], m * .016, 0, 7); x.fill(); x.stroke();
  });
}
// scritta in Pacifico rosa con estrusione crema e ombra prugna, come l'accordo del prototipo
function scritta(x, testo, tx, ty, fz) {
  const d = Math.max(2, Math.round(fz * .07));
  x.font = `${fz}px Pacifico, cursive`;
  x.fillStyle = rgba(C.prugna, .55); x.fillText(testo, tx + d * 1.8, ty + d * 1.8);
  x.fillStyle = C.crema; for (let i = d; i > 0; i--) x.fillText(testo, tx + i, ty + i);
  x.fillStyle = C.rosa; x.fillText(testo, tx, ty);
}

export const misura = formato => formato === 'verticale' ? [1080, 1920] : [1920, 1080];

export function disegna(cv, s, t) {
  const W = cv.width, H = cv.height, x = cv.getContext('2d'), m = Math.min(W, H);
  const v = s.video, vw = v.videoWidth, vh = v.videoHeight;
  // la camera riempie il riquadro tagliando i bordi; i punti delle mani passano dalla stessa trasformazione
  const sc = vw ? Math.max(W / vw, H / vh) : 1, ox = (W - vw * sc) / 2, oy = (H - vh * sc) / 2;
  const px = ([nx, ny]) => [ox + nx * vw * sc, oy + ny * vh * sc];
  x.save();
  if (s.specchio) { x.translate(W, 0); x.scale(-1, 1); }
  x.fillStyle = C.prugna; x.fillRect(0, 0, W, H);
  if (vw) x.drawImage(v, ox, oy, vw * sc, vh * sc);
  if (s.filtro) {
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C['prugna-2']); g.addColorStop(1, C.prugna);
    x.globalAlpha = VELO; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
    g = x.createRadialGradient(W * .4, H * .42, 0, W * .4, H * .42, m * .9);
    g.addColorStop(0, rgba(C.rosa, .38)); g.addColorStop(1, rgba(C.rosa, 0));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    GLITTER.forEach(q => { x.fillStyle = rgba(C.crema, .2 + .8 * Math.max(0, Math.sin(t * q.v + q.p))); star(x, q.x * W, q.y * H, m * .014 * q.s); });
  }
  const { accordi, seconda } = s.mani;
  if (accordi) drawHand(x, accordi.punti.map(px), m, t, C.rosa, f => accordi.alzate[f]);
  if (seconda) drawHand(x, seconda.punti.map(px), m, t, C['viola-luce'], f => seconda.alzate[f]);
  const L = s.mano === 'sinistra', bx = W * (L ? .05 : .95), r5 = m * .02;
  x.lineWidth = m * .004; x.strokeStyle = C.crema;
  for (let k = 0; k < 5; k++) {
    x.beginPath(); x.arc(bx, H * .62 - k * r5 * 2.6, r5, 0, 7);
    x.fillStyle = k >= s.lv ? rgba(C.crema, .2) : k === s.lv - 1 ? C.rosa : C['viola-luce'];
    x.fill(); if (k < s.lv) x.stroke();
  }
  x.restore();
  // onda: somma dei seni delle note che suonano; con gli accordi fermi è piatta
  const fs = s.fermi ? [] : s.hz, y0 = H * .86, amp = Math.min(H * .06, m * .09) * (.25 + .75 * s.lvl);
  // Coro e Vocoder: l'onda respira con la voce vera; Spento: accordi fissi come una tastiera
  const env = s.eff !== 'spento' ? .55 + .45 * Math.min(1, s.livello / RMS_PIENO) : .85;
  const wave = (scale, alpha) => {
    x.beginPath();
    for (let i = 0; i <= 220; i++) {
      const u = i / 220;
      const y = fs.length ? fs.reduce((a, f) => a + Math.sin(2 * Math.PI * u * f / 55 - t * f / 60), 0) / fs.length : 0;
      x[i ? 'lineTo' : 'moveTo'](u * W, y0 + y * amp * env * scale);
    }
    const lg = x.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, rgba(C.rosa, alpha)); lg.addColorStop(1, rgba(C['viola-luce'], alpha));
    x.strokeStyle = lg; x.stroke();
  };
  x.shadowColor = C.rosa; x.shadowBlur = m * .03;
  x.lineWidth = m * .004; wave(-.6, .35);
  x.lineWidth = m * .008; wave(1, 1);
  x.shadowBlur = 0;
  const fz = m * .11, tx = m * .06, ty = m * .05 + fz * 1.05;
  scritta(x, s.accordo, tx, ty, fz);
  if (s.titolo) {
    x.font = `${fz}px Pacifico, cursive`;
    const sx = tx + x.measureText(s.accordo).width + fz * .2, text = '– ' + s.titolo;
    let ts = fz * .5;
    x.font = `${ts}px Pacifico, cursive`;
    const room = W - m * .05 - sx, w = x.measureText(text).width;
    if (w > room) { ts *= room / w; x.font = `${ts}px Pacifico, cursive`; }
    x.fillStyle = rgba(C.prugna, .6); x.fillText(text, sx + 2, ty + 2);
    x.fillStyle = C.crema; x.fillText(text, sx, ty);
  }
  if (s.conto) {
    const cz = m * .45;
    x.textAlign = 'center'; scritta(x, String(s.conto), W / 2, H / 2 + cz * .35, cz); x.textAlign = 'left';
  }
}
