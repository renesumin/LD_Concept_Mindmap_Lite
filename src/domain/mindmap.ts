import { Position, type Edge, type Node } from '@xyflow/react';

export const axes = [
  { id: 'era', label: '시대', color: '#06B6D4' },
  { id: 'genre', label: '장르', color: '#A78BFA' },
  { id: 'action', label: '핵심 동사', color: '#F87171' },
  { id: 'space', label: '공간', color: '#FBBF24' },
  { id: 'element', label: '공간 구성 요소', color: '#34D399' },
] as const;
export type Axis = typeof axes[number]['id'];
export interface Word { id: string; parentId: string; axis: Axis; depth: number; text: string }
export interface MindmapDocument { concept: string; nodes: Word[] }
export interface Generation extends MindmapDocument { type: 'generation'; schemaVersion: '1.0' }
export interface Port { id: string; type: 'source' | 'target'; side: Position; offset: number }
export type MindmapNode = Node<{ label: string; color: string; kind: 'concept' | 'axis' | 'word'; subtitle: string; ports: Port[] }, 'mindmap'>;
export const WIDTH = 200;
export const HEIGHT = 78;
export const NODE_GAP = 16;
type Kind = MindmapNode['data']['kind'];
export type NodeSize = { width: number; height: number };
export type MeasureNode = (label: string, subtitle: string, kind: Kind, id: string) => NodeSize;
export function preferredWidth(label: string, kind: Kind): number {
  return kind === 'concept' ? Math.min(400, Math.max(280, Array.from(label).length * 10 + 40)) : kind === 'axis' ? 220 : WIDTH;
}
// Conservative non-DOM fallback for domain tests; the app measures rendered text.
const estimateSize: MeasureNode = (label, _subtitle, kind) => {
  const width = preferredWidth(label, kind);
  const fontSize = kind === 'concept' ? 21 : kind === 'axis' ? 18 : 17;
  const columns = Math.max(1, Math.floor((width - 36) / fontSize));
  const lines = label.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(Array.from(line).length / columns)), 0);
  return { width, height: Math.max(HEIGHT, 48 + lines * fontSize * 1.5) };
};
const axisIds = new Set<string>(axes.map(a => a.id));
export const axisNodeId = (axis: Axis): string => `axis-${axis}`;
export function parseGeneration(input: unknown): Generation {
  const fail = (message: string): never => { throw new Error(message); };
  if (!input || typeof input !== 'object') return fail('JSON 최상위는 객체여야 합니다.');
  const raw = input as Record<string, unknown>;
  if (raw.type !== 'generation' || raw.schemaVersion !== '1.0') return fail('type: "generation", schemaVersion: "1.0"만 지원합니다.');
  return { type: 'generation', schemaVersion: '1.0', ...parseDocumentFields(raw, 75, 3) };
}

// The generation contract stays strict; edited sessions share structural checks
// without imposing the original word count or depth limit.
export function parseDocumentFields(raw: Record<string, unknown>, count?: number, maxDepth?: number): MindmapDocument {
  const fail = (message: string): never => { throw new Error(message); };
  if (typeof raw.concept !== 'string' || !raw.concept.trim()) return fail('concept는 비어 있지 않은 문자열이어야 합니다.');
  if (!Array.isArray(raw.nodes)) return fail('nodes는 배열이어야 합니다.');
  if (count !== undefined && raw.nodes.length !== count) return fail(`nodes 배열에는 정확히 ${count}개의 단어가 필요합니다.`);
  const ids = new Set<string>(['concept', ...axes.map(a => axisNodeId(a.id))]);
  const nodes: Word[] = raw.nodes.map((value: unknown, i: number) => {
    if (!value || typeof value !== 'object') return fail(`nodes[${i}]는 객체여야 합니다.`);
    const n = value as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.id.trim() || ids.has(n.id)) return fail(`nodes[${i}]의 id가 비어 있거나 중복·예약되어 있습니다.`);
    ids.add(n.id);
    if (typeof n.axis !== 'string' || !axisIds.has(n.axis)) return fail(`${n.id}: axis가 올바르지 않습니다.`);
    if (!Number.isSafeInteger(n.depth) || (n.depth as number) < 1 || (maxDepth !== undefined && (n.depth as number) > maxDepth)) return fail(`${n.id}: depth가 올바르지 않습니다.`);
    if (typeof n.text !== 'string' || !n.text.trim()) return fail(`${n.id}: text가 비어 있습니다.`);
    if (typeof n.parentId !== 'string' || !n.parentId.trim()) return fail(`${n.id}: parentId는 비어 있지 않은 문자열이어야 합니다.`);
    return { id: n.id, parentId: n.parentId, axis: n.axis as Axis, depth: n.depth as number, text: n.text };
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const n of nodes) {
    const parent = n.parentId === axisNodeId(n.axis) ? undefined : byId.get(n.parentId);
    if (n.parentId !== axisNodeId(n.axis) && !parent) return fail(`${n.id}: 부모 ${n.parentId}를 찾을 수 없습니다.`);
    if (parent && (parent.axis !== n.axis || parent.depth + 1 !== n.depth)) return fail(`${n.id}: 부모와 axis 또는 depth가 맞지 않습니다.`);
    if (!parent && n.depth !== 1) return fail(`${n.id}: 축에 직접 연결되는 단어의 depth는 1이어야 합니다.`);
  }
  return { concept: raw.concept, nodes };
}

// Leaf-weighted sectors preserve each subtree. Place each measured card at the
// closest free point on its ray, without scaling unrelated branches.
export function buildMindmap(data: MindmapDocument, measure: MeasureNode = estimateSize): { nodes: MindmapNode[]; edges: Edge[] } {
  const children = new Map<string, Word[]>();
  for (const n of data.nodes) {
    const parent = n.parentId;
    children.set(parent, [...(children.get(parent) ?? []), n]);
  }
  const weights = new Map<string, number>();
  for (const n of [...data.nodes].sort((a, b) => b.depth - a.depth)) weights.set(n.id, Math.max(1, (children.get(n.id) ?? []).reduce((sum, child) => sum + weights.get(child.id)!, 0)));
  const weight = (id: string): number => weights.get(id) ?? 1;
  const nodes: MindmapNode[] = [];
  const edges: Edge[] = [];
  const add = (id: string, label: string, color: string, kind: MindmapNode['data']['kind'], x: number, y: number, subtitle: string) => {
    const { width, height } = measure(label, subtitle, kind, id);
    nodes.push({ id, type: 'mindmap', width, height, style: { width, height }, position: { x, y }, data: { label, color, kind, subtitle, ports: [] }, draggable: false, connectable: false });
  };
  add('concept', data.concept, '#e9e9ff', 'concept', 0, 0, 'LEVEL DESIGN CONCEPT');
  axes.forEach((axis, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    const sector = Math.PI * 2 / 5 * 0.94;
    add(axisNodeId(axis.id), axis.label, axis.color, 'axis', Math.cos(angle) * 360, Math.sin(angle) * 360, axis.id.toUpperCase());
    edges.push({ id: `concept:${axisNodeId(axis.id)}`, source: 'concept', target: axisNodeId(axis.id), style: { stroke: axis.color, strokeWidth: 2 } });
    const pending: { parent: string; start: number; span: number; node?: Word }[] = [{ parent: axisNodeId(axis.id), start: angle - sector / 2, span: sector }];
    while (pending.length) {
      const { parent, start, span, node } = pending.pop()!;
      if (node) {
        const theta = start + span / 2;
        const radius = 360 + node.depth * 340;
        add(node.id, node.text, axis.color, 'word', Math.cos(theta) * radius, Math.sin(theta) * radius, `${axis.label} · ${node.depth}단계`);
        edges.push({ id: `${node.parentId}:${node.id}`, source: node.parentId, target: node.id, style: { stroke: axis.color, strokeOpacity: 0.55 } });
      }
      const list = children.get(parent) ?? [];
      const total = list.reduce((sum, child) => sum + weight(child.id), 0);
      let cursor = start;
      const jobs = list.map(child => {
        const size = span * weight(child.id) / total;
        const job = { parent: child.id, start: cursor, span: size, node: child };
        cursor += size;
        return job;
      });
      pending.push(...jobs.reverse());
    }
  });
  const parentById = new Map(edges.map(edge => [edge.target, edge.source]));
  const radii = new Map<string, number>([['concept', 0]]);
  const placed: MindmapNode[] = [nodes[0]];
  // Breadth first: keep the five axes close to the concept before placing words.
  const depths = new Map(data.nodes.map(n => [n.id, n.depth]));
  // Explicit depth ordering avoids floating-point radius ties reshuffling siblings.
  const ordered = nodes.slice(1).sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0));
  for (const node of ordered) {
    const angle = Math.atan2(node.position.y, node.position.x);
    const ux = Math.cos(angle), uy = Math.sin(angle);
    let radius = (radii.get(parentById.get(node.id)!) ?? 0) + 48;
    const intervals: [number, number][] = [];
    const intersectDimension = (direction: number, center: number, half: number): [number, number] | null => {
      if (Math.abs(direction) < 1e-10) return Math.abs(center) < half ? [-Infinity, Infinity] : null;
      const ends = [(center - half) / direction, (center + half) / direction];
      return [Math.min(...ends), Math.max(...ends)];
    };
    for (const other of placed) {
      const x = intersectDimension(ux, other.position.x, (node.width! + other.width!) / 2 + NODE_GAP);
      const y = intersectDimension(uy, other.position.y, (node.height! + other.height!) / 2 + NODE_GAP);
      if (!x || !y) continue;
      const low = Math.max(x[0], y[0]), high = Math.min(x[1], y[1]);
      if (low <= high) intervals.push([low, high]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    for (const [low, high] of intervals) {
      if (radius >= low && radius <= high) radius = high + 0.01;
    }
    node.position = { x: ux * radius, y: uy * radius };
    radii.set(node.id, radius);
    placed.push(node);
  }
  for (const n of nodes) n.position = { x: n.position.x - n.width! / 2, y: n.position.y - n.height! / 2 };
  routeEdges(nodes, edges);
  return { nodes, edges };
}

// Use facing boundaries with positive space between them. Bezier control points
// then advance towards the child instead of bending back around the parent.
export function routeEdges(nodes: MindmapNode[], edges: Edge[]): void {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const groups = new Map<string, { port: Port; order: number }[]>();
  for (const node of nodes) node.data.ports = [];
  for (const edge of edges) {
    const a = byId.get(edge.source)!, b = byId.get(edge.target)!;
    const dx = b.position.x + b.width! / 2 - a.position.x - a.width! / 2;
    const dy = b.position.y + b.height! / 2 - a.position.y - a.height! / 2;
    const gapX = Math.abs(dx) - (a.width! + b.width!) / 2;
    const gapY = Math.abs(dy) - (a.height! + b.height!) / 2;
    const horizontal = gapX >= NODE_GAP - 0.001 && (gapY < NODE_GAP - 0.001 || Math.abs(dx) / (a.width! + b.width!) >= Math.abs(dy) / (a.height! + b.height!));
    const sourceSide = horizontal ? (dx >= 0 ? Position.Right : Position.Left) : (dy >= 0 ? Position.Bottom : Position.Top);
    const targetSide = horizontal ? (dx >= 0 ? Position.Left : Position.Right) : (dy >= 0 ? Position.Top : Position.Bottom);
    const source: Port = { id: `out:${edge.target}`, type: 'source', side: sourceSide, offset: 50 };
    const target: Port = { id: `in:${edge.source}`, type: 'target', side: targetSide, offset: 50 };
    a.data.ports.push(source); b.data.ports.push(target);
    edge.sourceHandle = source.id; edge.targetHandle = target.id;
    edge.type = 'default';
    // Facing sides have a positive gap: React Flow uses forward cubic controls.
    Object.assign(edge, { pathOptions: { curvature: 0.15 } });
    const key = `${a.id}:${sourceSide}`;
    const group = groups.get(key) ?? [];
    group.push({ port: source, order: horizontal ? b.position.y + b.height! / 2 : b.position.x + b.width! / 2 });
    groups.set(key, group);
  }
  // Keep sibling ports in the same screen order as their destinations. Separate
  // concept-to-axis ports too, so branches do not all leave a single point.
  for (const group of groups.values()) {
    group.sort((a, b) => a.order - b.order);
    group.forEach(({ port }, index) => { port.offset = group.length === 1 ? 50 : 20 + 60 * (index + 1) / (group.length + 1); });
  }
}
