import { preferredWidth, type MeasureNode } from './domain/mindmap';
import { characterCount } from './domain/editing';

// Measure with the same font, wrapping, padding and borders as the visible card.
// React Flow receives these dimensions before layout and anchors its handles to them.
export const measureNode: MeasureNode = (label, subtitle, kind) => {
  const card = document.createElement('div');
  card.className = `map-node ${kind}`;
  card.style.setProperty('--axis-color', '#A78BFA');
  Object.assign(card.style, {
    position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
    left: '-10000px', top: '0', width: `${preferredWidth(label, kind)}px`, height: 'auto',
  });
  const caption = document.createElement('span');
  caption.className = 'node-caption';
  caption.textContent = subtitle;
  const body = document.createElement('strong');
  body.textContent = label;
  card.append(caption, body);
  document.body.append(card);
  try {
    const bounds = card.getBoundingClientRect();
    return { width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) };
  } finally { card.remove(); }
};

export function measureEditingNode(label: string, subtitle: string, kind: Parameters<MeasureNode>[2], draft: string, error: string) {
  const card = document.createElement('div');
  card.className = `map-node ${kind}`;
  card.style.setProperty('--axis-color', '#A78BFA');
  Object.assign(card.style, { position: 'absolute', visibility: 'hidden', left: '-10000px', top: '0', width: `${preferredWidth(label, kind)}px`, height: 'auto' });
  const caption = document.createElement('span'); caption.className = 'node-caption'; caption.textContent = subtitle;
  const editor = document.createElement('div'); editor.className = 'node-editor';
  const input = document.createElement('textarea'); input.rows = 1; input.value = draft;
  const help = document.createElement('span'); help.className = 'edit-help'; help.textContent = `${kind === 'word' ? `${characterCount(draft.trim())}/15 · ` : ''}Enter 확정 · Esc 취소`;
  const actions = document.createElement('div'); actions.className = 'edit-actions';
  for (const text of ['확정', '취소']) { const button = document.createElement('button'); button.textContent = text; actions.append(button); }
  editor.append(input, help);
  if (error) { const alert = document.createElement('span'); alert.className = 'edit-error'; alert.textContent = error; editor.append(alert); }
  editor.append(actions); card.append(caption, editor); document.body.append(card);
  try {
    input.style.height = 'auto'; input.style.height = `${input.scrollHeight + 2}px`;
    const rect = card.getBoundingClientRect();
    return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  } finally { card.remove(); }
}
