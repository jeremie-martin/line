// What the owner has answered on the closing boards: one study (labels/studies/closing-2026-11.jsonl), one row per save, the
// latest row per id counts. Ids: a decision's id (decisions.json) or a song's name. answers: {choice} or {mark}; note: his words.
export const STUDY = 'closing-2026-11';

/** id → {answers, note}, the latest saved row of each. */
export async function loadAnswers() {
  const saved = new Map(), r = await fetch(`/labels/studies/${STUDY}.jsonl`, {cache: 'no-store'});
  if (r.ok) for (const line of (await r.text()).split('\n').filter(Boolean)) {const row = JSON.parse(line); saved.set(row.clip, {answers: row.answers ?? {}, note: row.note ?? ''});}
  return saved;
}

/** Appends one row; resolves to '' when saved, or to the reason it was not. */
export async function saveAnswer(id, answers, note) {
  try {
    const r = await fetch(`/api/labels/${STUDY}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({clip: id, skipped: false, answers, note})});
    return r.ok ? '' : (await r.json()).error ?? `status ${r.status}`;
  } catch (error) {return error.message;}
}

/** Shows the outcome of a save in a status element. */
export function report(element, error, what) {
  element.textContent = error ? `Not saved: ${error}` : `Saved: ${what} (${new Date().toLocaleTimeString()}).`;
  element.classList.toggle('bad', !!error);
}

export const el = (tag, props = {}, ...children) => {const e = Object.assign(document.createElement(tag), props); e.append(...children.filter(c => c != null)); return e;};
