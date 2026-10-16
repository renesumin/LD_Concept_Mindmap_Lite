import type { Viewport } from '@xyflow/react';
import { axes, axisNodeId, parseDocumentFields, parseGeneration, routeEdges, type Generation, type MindmapDocument, type MindmapNode } from './mindmap';

export interface SavedPosition { id: string; x: number; y: number }
export interface Session extends MindmapDocument {
  type: 'session'; schemaVersion: '1.0'; positions: SavedPosition[]; viewport: Viewport;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseSession(input: unknown): Session {
  if (!object(input) || input.type !== 'session' || input.schemaVersion !== '1.0') throw new Error('지원하지 않는 세션 형식입니다.');
  const doc = parseDocumentFields(input);
  const expected = new Set(['concept', ...axes.map(a => axisNodeId(a.id)), ...doc.nodes.map(n => n.id)]);
  if (!Array.isArray(input.positions) || input.positions.length !== expected.size) throw new Error('세션에는 중심·축·일반 노드 전체의 좌표가 필요합니다.');
  const positions = input.positions.map((value: unknown) => {
    if (!object(value) || typeof value.id !== 'string' || !expected.delete(value.id) || !finite(value.x) || !finite(value.y)) throw new Error('노드 좌표에 중복·누락 또는 잘못된 값이 있습니다.');
    return { id: value.id, x: value.x, y: value.y };
  });
  const v = input.viewport;
  if (!object(v) || !finite(v.x) || !finite(v.y) || !finite(v.zoom) || v.zoom < 0.01 || v.zoom > 2.5) throw new Error('화면 위치 또는 확대 비율이 올바르지 않습니다.');
  return { ...doc, type: 'session', schemaVersion: '1.0', positions, viewport: { x: v.x, y: v.y, zoom: v.zoom } };
}

export function parseMindmapFile(input: unknown): Generation | Session {
  if (object(input) && input.type === 'session') return parseSession(input);
  return parseGeneration(input);
}

export function createSession(doc: MindmapDocument, nodes: MindmapNode[], viewport: Viewport): Session {
  // Serialize only document fields, not React Flow callbacks, handles or selection.
  return parseSession({ type: 'session', schemaVersion: '1.0', concept: doc.concept,
    nodes: doc.nodes.map(n => ({ id: n.id, parentId: n.parentId, axis: n.axis, depth: n.depth, text: n.text })),
    positions: nodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y })), viewport });
}

export function applySavedPositions(map: ReturnType<typeof import('./mindmap').buildMindmap>, positions: SavedPosition[]) {
  const byId = new Map(positions.map(p => [p.id, p]));
  for (const node of map.nodes) {
    const p = byId.get(node.id);
    if (!p) throw new Error(`${node.id}: 저장된 좌표가 없습니다.`);
    node.position = { x: p.x, y: p.y };
  }
  routeEdges(map.nodes, map.edges);
  return map;
}

export function conceptSlug(concept: string): string {
  return Array.from(concept.normalize('NFC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')).slice(0, 64).join('').replace(/-+$/g, '') || 'mindmap';
}
