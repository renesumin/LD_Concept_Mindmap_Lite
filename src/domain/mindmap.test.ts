import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Position, getBezierPath } from '@xyflow/react';
import { buildMindmap, parseGeneration, routeEdges, NODE_GAP, axes, type MindmapNode, type Port } from './mindmap';
const sample = () => JSON.parse(readFileSync(new URL('../../public/sample-generation.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
test('75 words produce 81 non-overlapping cards and 80 parent edges', () => {
  const data = parseGeneration(sample());
  const map = buildMindmap(data);
  assert.equal(map.nodes.length, 81); assert.equal(map.edges.length, 80);
  for (const n of data.nodes) assert.ok(map.edges.some(e => e.target === n.id && e.source === n.parentId));
  assertNoOverlap(map.nodes);
});
test('invalid parent, cross-axis parent, cycles, duplicates and unsupported versions fail', () => {
  for (const mutate of [
    (d: ReturnType<typeof sample>) => { d.nodes[0].parentId='missing'; },
    (d: ReturnType<typeof sample>) => { d.nodes[3].parentId='genre-1'; },
    (d: ReturnType<typeof sample>) => { d.nodes[0].parentId=d.nodes[0].id; },
    (d: ReturnType<typeof sample>) => { d.nodes[1].id=d.nodes[0].id; },
    (d: ReturnType<typeof sample>) => { d.schemaVersion='2.0'; },
  ]) { const d=sample();mutate(d);assert.throws(()=>parseGeneration(d)); }
});
test('unbalanced 75-leaf tree stays non-overlapping', () => {
  const d=sample();d.nodes=d.nodes.map((n: {id:string},i:number)=>({...n,axis:'era',depth:1,parentId:'axis-era',text:`단어 ${i}`}));
  const map=buildMindmap(parseGeneration(d));
  assertNoOverlap(map.nodes);
});

test('Antigravity axis parents generate every axis and all depth 1–3 edges', () => {
  const raw = sample();
  // Preserve the 75 words while adding a third level and arbitrary array order.
  raw.nodes.find((n: {id: string}) => n.id === 'era-5').parentId = 'era-4';
  raw.nodes.find((n: {id: string}) => n.id === 'era-5').depth = 3;
  raw.nodes.reverse();
  const data = parseGeneration(raw);
  const map = buildMindmap(data);
  const ids = new Set(map.nodes.map(n => n.id));
  assert.equal(ids.size, 81);
  for (const axis of ['era', 'genre', 'action', 'space', 'element']) {
    assert.ok(ids.has(`axis-${axis}`));
    assert.ok(map.edges.some(e => e.source === 'concept' && e.target === `axis-${axis}`));
  }
  for (const n of data.nodes) {
    const incoming = map.edges.filter(e => e.target === n.id);
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].source, n.parentId);
  }
  assert.ok(map.edges.every(e => ids.has(e.source) && ids.has(e.target)));
});

test('wrong axis, invalid depth and reserved fixed axis IDs are rejected', () => {
  for (const patch of [
    { parentId: 'axis-genre' },
    { parentId: 'era' },
    { parentId: null },
    { depth: 2, parentId: 'axis-era' },
    { depth: 1, parentId: 'era-4' },
    { depth: 3, parentId: 'era-1' },
    { depth: 4 },
    { id: 'axis-era' },
  ]) {
    const d = sample();
    Object.assign(d.nodes[0], patch);
    assert.throws(() => parseGeneration(d));
  }
});

function assertNoOverlap(nodes: MindmapNode[]) {
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    const gapX = Math.max(b.position.x - (a.position.x + a.width!), a.position.x - (b.position.x + b.width!));
    const gapY = Math.max(b.position.y - (a.position.y + a.height!), a.position.y - (b.position.y + b.height!));
    assert.ok(gapX >= NODE_GAP - 0.001 || gapY >= NODE_GAP - 0.001, `${a.id} overlaps ${b.id}`);
  }
}

test('long concepts and multiline words expand cards without overlap', () => {
  const raw = sample();
  raw.concept = '수직으로 연결된 고대 도시에서 잊힌 기억을 탐색하는 레벨 디자인 컨셉 '.repeat(12);
  raw.nodes[0].text = '아주 긴 단어와 설명이 자동으로 줄바꿈되어야 합니다 '.repeat(20);
  raw.nodes[1].text = '첫 번째 줄\n두 번째 줄\n세 번째 줄\n네 번째 줄';
  const map = buildMindmap(parseGeneration(raw));
  assert.ok(map.nodes[0].width! > 240);
  assert.ok(map.nodes[0].height! > 100);
  assert.ok(map.nodes.find(n => n.id === raw.nodes[0].id)!.height! > 100);
  assertNoOverlap(map.nodes);
});

test('all 75 parent-child relations and axis colors match JSON after sizing', () => {
  const raw = sample();
  for (const axis of axes) {
    const leaf = raw.nodes.find((n: {id:string}) => n.id === `${axis.id}-5`);
    leaf.parentId = `${axis.id}-4`; leaf.depth = 3;
  }
  raw.nodes.reverse();
  const data = parseGeneration(raw);
  // Inject varied measured sizes to cover the browser measurement layout path.
  const map = buildMindmap(data, (label, _subtitle, kind) => ({
    width: kind === 'concept' ? 520 : 240,
    height: 100 + label.length * 9,
  }));
  const actual = map.edges.filter(e => e.source !== 'concept').map(e => [e.source, e.target].join(' -> ')).sort();
  const expected = data.nodes.map(n => [n.parentId, n.id].join(' -> ')).sort();
  assert.equal(actual.length, 75);
  assert.deepEqual(actual, expected);
  assert.deepEqual(axes.map(a => a.color), ['#06B6D4', '#A78BFA', '#F87171', '#FBBF24', '#34D399']);
  for (const axis of axes) {
    assert.equal(map.nodes.find(n => n.id === `axis-${axis.id}`)!.data.color, axis.color);
    for (const word of data.nodes.filter(n => n.axis === axis.id)) {
      assert.equal(map.nodes.find(n => n.id === word.id)!.data.color, axis.color);
      assert.equal(map.edges.find(e => e.target === word.id)!.style!.stroke, axis.color);
    }
    assert.equal(map.edges.find(e => e.target === `axis-${axis.id}`)!.style!.stroke, axis.color);
  }
  assertNoOverlap(map.nodes);
});

test('compact layout reduces sample extent and parent distances without changing data', () => {
  const data = parseGeneration(sample());
  const before = JSON.stringify(data);
  const map = buildMindmap(data, (_label, _subtitle, kind) => ({
    width: kind === 'concept' ? 300 : kind === 'axis' ? 220 : 200,
    height: kind === 'concept' ? 96 : kind === 'axis' ? 86 : 78,
  }));
  const bounds = {
    width: Math.max(...map.nodes.map(n => n.position.x + n.width!)) - Math.min(...map.nodes.map(n => n.position.x)),
    height: Math.max(...map.nodes.map(n => n.position.y + n.height!)) - Math.min(...map.nodes.map(n => n.position.y)),
  };
  // Keep a density budget as well as checking pairwise overlap.
  assert.ok(bounds.width < 2400 && bounds.height < 2400, JSON.stringify(bounds));
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  const distances = map.edges.map(e => {
    const a = byId.get(e.source)!, b = byId.get(e.target)!;
    return Math.hypot(a.position.x + a.width! / 2 - b.position.x - b.width! / 2,
      a.position.y + a.height! / 2 - b.position.y - b.height! / 2);
  });
  assert.ok(distances.reduce((a, b) => a + b, 0) / distances.length < 450);
  assert.equal(JSON.stringify(data), before);
  assertNoOverlap(map.nodes);
});

function portPoint(node: MindmapNode, port: Port) {
  const { x, y } = node.position;
  const w = node.width!, h = node.height!;
  return port.side === Position.Left ? { x, y: y + h * port.offset / 100 }
    : port.side === Position.Right ? { x: x + w, y: y + h * port.offset / 100 }
    : port.side === Position.Top ? { x: x + w * port.offset / 100, y }
    : { x: x + w * port.offset / 100, y: y + h };
}

test('all 80 Bezier edges use facing boundary handles and never turn back', () => {
  const map = buildMindmap(parseGeneration(sample()));
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  const directions = new Set<Position>();
  for (const edge of map.edges) {
    const a = byId.get(edge.source)!, b = byId.get(edge.target)!;
    const source = a.data.ports.find(p => p.id === edge.sourceHandle)!;
    const target = b.data.ports.find(p => p.id === edge.targetHandle)!;
    assert.equal(source.type, 'source'); assert.equal(target.type, 'target');
    directions.add(source.side);
    const start = portPoint(a, source), end = portPoint(b, target);
    const horizontal = source.side === Position.Left || source.side === Position.Right;
    const sign = source.side === Position.Left || source.side === Position.Top ? -1 : 1;
    assert.ok(sign * (horizontal ? end.x - start.x : end.y - start.y) >= NODE_GAP - 0.001);
    const [path] = getBezierPath({ sourceX: start.x, sourceY: start.y, targetX: end.x, targetY: end.y,
      sourcePosition: source.side, targetPosition: target.side, curvature: 0.15 });
    const values = path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
    const [x0,y0,x1,y1,x2,y2,x3,y3] = values;
    assert.deepEqual([x0,y0,x3,y3], [start.x,start.y,end.x,end.y]);
    const forward = horizontal ? [x0,x1,x2,x3] : [y0,y1,y2,y3];
    for(let i=1;i<4;i++) assert.ok(sign * (forward[i] - forward[i-1]) >= -0.001, edge.id);
    for(let step=1;step<40;step++) {
      const t=step/40,u=1-t;
      const x=u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3;
      const y=u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3;
      for(const n of [a,b]) assert.ok(!(x>n.position.x+.001&&x<n.position.x+n.width!-.001&&y>n.position.y+.001&&y<n.position.y+n.height!-.001), edge.id);
    }
  }
  assert.equal(directions.size, 4);
});

test('sibling ports follow destination order and routing leaves positions and relationships intact', () => {
  const map = buildMindmap(parseGeneration(sample()));
  const before = JSON.stringify(map.nodes.map(n => [n.id,n.position,n.width,n.height]));
  const relations = map.edges.map(e => [e.source,e.target]);
  routeEdges(map.nodes,map.edges);
  assert.equal(JSON.stringify(map.nodes.map(n => [n.id,n.position,n.width,n.height])),before);
  assert.deepEqual(map.edges.map(e => [e.source,e.target]),relations);
  const byId=new Map(map.nodes.map(n=>[n.id,n]));
  for(const node of map.nodes) for(const side of Object.values(Position)) {
    const group=map.edges.filter(e=>e.source===node.id&&node.data.ports.find(p=>p.id===e.sourceHandle)?.side===side);
    const horizontal=side===Position.Left||side===Position.Right;
    group.sort((a,b)=>{
      const na=byId.get(a.target)!,nb=byId.get(b.target)!;
      return horizontal ? na.position.y+na.height!/2-nb.position.y-nb.height!/2 : na.position.x+na.width!/2-nb.position.x-nb.width!/2;
    });
    const offsets=group.map(e=>node.data.ports.find(p=>p.id===e.sourceHandle)!.offset);
    for(let i=1;i<offsets.length;i++) assert.ok(offsets[i]>offsets[i-1]);
  }
  assertNoOverlap(map.nodes);
});
