// Riproduce nel grafo Web Audio i blocchi PCM che arrivano da Rust, con 100 ms di cuscinetto (prototipo prova-ritardo, #6).
class Pcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.q = []; this.off = 0; this.size = 0; this.started = false; this.under = 0; this.n = 0;
    this.port.onmessage = (e) => { this.q.push(e.data); this.size += e.data.length; };
  }
  process(_, [out]) {
    const o = out[0];
    if (!this.started && this.size >= 4800) this.started = true;
    if (this.started && this.size < o.length) this.under++;
    for (let i = 0; i < o.length; i++) {
      if (!this.started || !this.q.length) { o[i] = 0; continue; }
      const b = this.q[0];
      o[i] = b[this.off++]; this.size--;
      if (this.off === b.length) { this.q.shift(); this.off = 0; }
    }
    if (++this.n % 375 === 0) this.port.postMessage({ size: this.size, under: this.under });
    return true;
  }
}
registerProcessor('pcm', Pcm);
