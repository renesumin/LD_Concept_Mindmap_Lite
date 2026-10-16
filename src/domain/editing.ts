import { axes, axisNodeId, type MindmapDocument, type Word } from './mindmap';

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
export const characterCount = (text: string): number => Array.from(segmenter.segment(text)).length;
const normalize = (text: string): string => text.trim().normalize('NFC');

export function validateWordText(doc: MindmapDocument, text: string, exceptId?: string): string {
  const value = normalize(text);
  if (!value) throw new Error('단어는 비워둘 수 없습니다.');
  if (characterCount(value) > 15) throw new Error('일반 노드는 최대 15자까지 입력할 수 있습니다.');
  if (doc.nodes.some(n => n.id !== exceptId && normalize(n.text) === value)) throw new Error('이미 같은 단어가 있습니다. 다른 단어를 입력해주세요.');
  return value;
}

export function renameNode(doc: MindmapDocument, id: string, text: string): MindmapDocument {
  if (id === 'concept') {
    const concept = normalize(text);
    if (!concept) throw new Error('컨셉 문장은 비워둘 수 없습니다.');
    return { ...doc, concept };
  }
  if (!doc.nodes.some(n => n.id === id)) throw new Error('일반 노드만 수정할 수 있습니다.');
  const value = validateWordText(doc, text, id);
  return { ...doc, nodes: doc.nodes.map(n => n.id === id ? { ...n, text: value } : n) };
}

export function draftChild(doc: MindmapDocument, parentId: string, id: string): Word {
  if (!id || id === 'concept' || axes.some(a => axisNodeId(a.id) === id) || doc.nodes.some(n => n.id === id)) throw new Error('새 노드 ID가 중복되었습니다.');
  const parent = doc.nodes.find(n => n.id === parentId);
  const axis = axes.find(a => axisNodeId(a.id) === parentId);
  if (!parent && !axis) throw new Error('축 또는 일반 노드를 선택해주세요.');
  return { id, parentId, axis: parent?.axis ?? axis!.id, depth: parent ? parent.depth + 1 : 1, text: '' };
}

export function addChild(doc: MindmapDocument, parentId: string, id: string, text: string): MindmapDocument {
  const node = draftChild(doc, parentId, id);
  node.text = validateWordText(doc, text);
  return { ...doc, nodes: [...doc.nodes, node] };
}

export function descendantIds(doc: MindmapDocument, id: string): Set<string> {
  if (!doc.nodes.some(n => n.id === id)) throw new Error('일반 노드만 삭제할 수 있습니다.');
  const children = new Map<string, string[]>();
  for (const n of doc.nodes) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id]);
  const ids = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const next = pending.pop()!;
    if (ids.has(next)) continue;
    ids.add(next); pending.push(...(children.get(next) ?? []));
  }
  return ids;
}

export function deleteBranch(doc: MindmapDocument, id: string): MindmapDocument {
  const deleted = descendantIds(doc, id);
  return { ...doc, nodes: doc.nodes.filter(n => !deleted.has(n.id)) };
}
