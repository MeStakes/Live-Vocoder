// Registrazione (spec §6): canvas (captureStream 30) + PCM della voce trattata in un solo MediaRecorder MP4.
// Ogni secondo il pezzo va a Rust e si aggiunge al file, nell'ordine in cui arriva.
import { ascolta } from './motore.js';
const invoke = (...a) => window.__TAURI__.core.invoke(...a);

// actx: AudioContext creato al clic su Registra (nel gesto dell'utente, così non resta sospeso).
export async function avviaRegistrazione({ actx, canvas, cartella, canzone, onErrore }) {
  const path = await invoke('apri_registrazione', { cartella, canzone });
  try {
    await actx.audioWorklet.addModule('worklet.js');
    const node = new AudioWorkletNode(actx, 'pcm', { numberOfInputs: 0, outputChannelCount: [1] });
    const dest = actx.createMediaStreamDestination();
    node.connect(dest);
    const stacca = ascolta(f => node.port.postMessage(f));
    const tracce = [canvas.captureStream(30).getVideoTracks()[0], dest.stream.getAudioTracks()[0]];
    const rec = new MediaRecorder(new MediaStream(tracce), { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', audioBitsPerSecond: 192e3 });
    let coda = Promise.resolve(), errore = null;
    rec.ondataavailable = e => {
      coda = coda.then(async () => {
        if (errore || !e.data.size) return;
        try { await invoke('aggiungi_pezzo', new Uint8Array(await e.data.arrayBuffer())); }
        catch (err) { errore = err; onErrore(err); }
      });
    };
    const finito = new Promise(r => (rec.onstop = r));
    rec.start(1000); // obbligatorio: senza timeslice WebKit smette di scrivere il video dopo ~20 MB (#6)
    return {
      path,
      async ferma() {
        if (rec.state !== 'inactive') rec.stop();
        await finito;
        await coda;
        stacca();
        tracce.forEach(t => t.stop());
        actx.close();
        await invoke('chiudi_registrazione');
        return path;
      },
    };
  } catch (e) {
    await invoke('chiudi_registrazione');
    actx.close();
    throw e;
  }
}
