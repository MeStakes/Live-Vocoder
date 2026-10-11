// Avvisi rosa nello stile dell'app, non finestre di sistema. Un avviso per chiave: rimetterlo lo aggiorna.
const box = () => document.getElementById('avvisi');
const el = (tag, props) => Object.assign(document.createElement(tag), props);

export function avviso(chiave, testo, azioni = []) {
  let a = box().querySelector(`[data-chiave="${chiave}"]`);
  if (!a) { a = el('div', { className: 'avviso' }); a.dataset.chiave = chiave; box().append(a); }
  a.replaceChildren(el('span', { textContent: testo }),
    ...azioni.map(([t, f]) => el('button', { className: 'pill small', textContent: t, onclick: () => { togli(chiave); f(); } })),
    el('button', { className: 'chiudi', textContent: '×', ariaLabel: 'Chiudi', onclick: () => togli(chiave) }));
}

export function togli(chiave) { box().querySelector(`[data-chiave="${chiave}"]`)?.remove(); }

// Per le cose controllate ogni 2 s: l'avviso compare quando lo stato comincia, non a ogni controllo, e sparisce quando finisce.
const visti = new Set();
export function stato(chiave, attivo, testo, azioni) {
  if (!attivo) { visti.delete(chiave); return togli(chiave); }
  if (!visti.has(chiave)) { visti.add(chiave); avviso(chiave, testo, azioni); }
}
