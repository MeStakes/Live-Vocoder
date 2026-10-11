// PROTOTIPO usa e getta, ticket "Prova del Ritardo e della camera" (#6).
const { invoke, Channel } = window.__TAURI__.core;
const $ = (id) => document.getElementById(id);
const say = (line) => {
  $('out').textContent += line + '\n';
  $('out').scrollTop = 1e9;
  invoke('log', { line: new Date().toISOString() + ' ' + line });
};
const fill = (sel, items, re) => {
  sel.innerHTML = '';
  for (const { label, value } of items) sel.add(new Option(label, value, false, re.test(label)));
};
const guard = (fn) => async () => { try { await fn(); } catch (e) { say('ERRORE ' + e); } };

// --- Audio: Rust manda il mix d'uscita come PCM float32 grezzo
let wave = new Float32Array(2048), recNode = null, typeLogged = false;
const pcm = new Channel();
pcm.onmessage = (buf) => {
  if (!typeLogged) { typeLogged = true; say('Channel PCM riceve: ' + Object.prototype.toString.call(buf)); }
  const f = new Float32Array(buf);
  if (f.length >= wave.length) wave = f.slice(-wave.length);
  else { wave.copyWithin(0, f.length); wave.set(f, wave.length - f.length); }
  if (recNode) recNode.port.postMessage(f, [f.buffer]);
};

(async () => {
  const [ins, outs] = await invoke('devices');
  fill($('in'), ins.map((n) => ({ label: n, value: n })), /MacBook/);
  fill($('outdev'), outs.map((n) => ({ label: n, value: n })), /Cuffie|Headphones/);
  say(navigator.userAgent);
  for (const m of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm'])
    say(`MediaRecorder ${m}: ${MediaRecorder.isTypeSupported(m)}`);
  say('AudioEncoder AAC: ' + (window.AudioEncoder ? (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 1, bitrate: 192000 })).supported : 'assente'));
  say('VideoEncoder H.264 1080x1920: ' + (window.VideoEncoder ? (await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 1080, height: 1920, bitrate: 8e6, framerate: 30 })).supported : 'assente'));
})().catch((e) => say('ERRORE ' + e));

$('start').onclick = guard(async () => say(await invoke('start', { input: $('in').value, output: $('outdev').value, buffer: +$('buf').value, pcm })));
$('stop').onclick = guard(() => invoke('stop'));
$('voc').onchange = guard(() => invoke('set_vocoder', { on: $('voc').checked }));
$('measure').onclick = guard(async () => { say('misuro (5 impulsi)...'); say(await invoke('measure')); $('voc').checked = false; invoke('set_vocoder', { on: false }); });

// --- Camera nel canvas 9:16 o 16:9, con forma d'onda e orologio sopra
const video = $('video'), cv = $('cv'), ctx = cv.getContext('2d');
$('cams').onclick = guard(async () => {
  (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach((t) => t.stop());
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  fill($('cam'), cams.map((c) => ({ label: c.label, value: c.deviceId })), /iPhone/);
  say('camere: ' + cams.map((c) => c.label).join(' | '));
});
$('camstart').onclick = guard(async () => {
  const v = $('fmt').value === 'v';
  [cv.width, cv.height] = v ? [1080, 1920] : [1920, 1080];
  video.srcObject?.getTracks().forEach((t) => t.stop());
  const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: $('cam').value }, width: { ideal: cv.width }, height: { ideal: cv.height }, frameRate: { ideal: 30 } } });
  const track = stream.getVideoTracks()[0];
  video.srcObject = stream;
  await video.play();
  say(`camera ${track.label}: impostazioni ${JSON.stringify(track.getSettings())}`);
  say('capacità ' + JSON.stringify(track.getCapabilities?.() ?? {}));
});
video.onresize = () => {
  const s = Math.max(cv.width / video.videoWidth, cv.height / video.videoHeight);
  say(`frame camera ${video.videoWidth}x${video.videoHeight}; il canvas ${cv.width}x${cv.height} usa ${Math.round(cv.width / s)}x${Math.round(cv.height / s)} pixel veri (scala ${s.toFixed(2)})`);
};
(function draw() {
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#2a0f3a';
  ctx.fillRect(0, 0, W, H);
  if (video.videoWidth) {
    const s = Math.max(W / video.videoWidth, H / video.videoHeight), w = video.videoWidth * s, h = video.videoHeight * s;
    ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
  }
  ctx.strokeStyle = '#ff6ad5';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = 0; i < wave.length; i++) ctx.lineTo((i / wave.length) * W, H * 0.85 + wave[i] * H * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '64px sans-serif';
  ctx.fillText('PROTOTIPO ' + (performance.now() / 1000).toFixed(2), 40, 100);
  requestAnimationFrame(draw);
})();

// --- Registrazione: canvas + PCM di Rust (AudioWorklet -> MediaStreamDestination) in un solo MediaRecorder
$('rec').onclick = guard(async () => {
  const sec = +$('sec').value;
  const actx = new AudioContext({ sampleRate: 48000 });
  await actx.audioWorklet.addModule('worklet.js');
  const node = new AudioWorkletNode(actx, 'pcm', { numberOfInputs: 0, outputChannelCount: [1] });
  const dest = actx.createMediaStreamDestination();
  node.connect(dest);
  let qmin = Infinity, qmax = 0, under = 0;
  node.port.onmessage = (e) => { qmin = Math.min(qmin, e.data.size); qmax = Math.max(qmax, e.data.size); under = e.data.under; };
  recNode = node;
  const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const tracks = [cv.captureStream(30).getVideoTracks()[0], dest.stream.getAudioTracks()[0]];
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 192e3 });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start();
  say(`registro ${sec} s, ${rec.mimeType}, AudioContext ${actx.state} ${actx.sampleRate} Hz`);
  for (let t = sec; t > 0; t--) { $('count').textContent = t + ' s'; await new Promise((r) => setTimeout(r, 1000)); }
  $('count').textContent = '';
  rec.stop();
  await done;
  recNode = null;
  actx.close();
  const blob = new Blob(chunks, { type: rec.mimeType });
  const name = `prova-${cv.width}x${cv.height}-${Date.now()}.${rec.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
  const path = await invoke('save', new Uint8Array(await blob.arrayBuffer()), { headers: { 'x-name': name } });
  say(`salvato ${path} (${(blob.size / 1e6).toFixed(1)} MB); coda worklet min ${qmin} max ${qmax} campioni, vuoti ${under}`);
});
