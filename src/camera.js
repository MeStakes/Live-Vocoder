// La camera del video (spec §5): prima la camera preferita di sistema (WebKit mostra l'iPhone solo così, #6), poi getUserMedia.
const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export async function apriCamera(video, nome, [w, h]) {
  if (nome) await invoke('prefer_camera', { nome }).catch(() => {});
  video.srcObject?.getTracks().forEach(t => t.stop());
  // senza un primo permesso i nomi delle camere sono vuoti
  (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach(t => t.stop());
  const lista = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && !/Panoramica|Desk View/.test(d.label));
  const d = lista.find(d => d.label === nome) ?? lista.find(d => nome && d.label.includes(nome)) ?? lista[0];
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: d && { exact: d.deviceId }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30, max: 30 } },
  });
  await video.play();
}
