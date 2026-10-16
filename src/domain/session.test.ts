import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMindmap, type MindmapDocument } from './mindmap';
import { addChild, deleteBranch, renameNode } from './editing';
import { applySavedPositions, conceptSlug, createSession, parseMindmapFile, parseSession } from './session';
import { exportGeometry, MAX_PNG_SIDE, PNG_PADDING, PNG_SCALE } from './exportGeometry';

const sample = () => JSON.parse(readFileSync(new URL('../../public/sample-generation.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

test('edited session roundtrip preserves text, added/deleted nodes, coordinates and viewport exactly', () => {
  let doc: MindmapDocument = parseMindmapFile(sample());
  doc = renameNode(doc, 'concept', '복원 테스트 컨셉 문장');
  doc = renameNode(doc, 'era-1', '수정된 시대');
  doc = addChild(doc, 'era-4', 'manual-1', '수동 자손');
  doc = addChild(doc, 'manual-1', 'manual-2', '수동 손자');
  doc = deleteBranch(doc, 'genre-1');
  const map = buildMindmap(doc);
  map.nodes[0].position = { x: -123.456, y: 789.012 };
  const viewport = { x: -437.25, y: 291.125, zoom: 0.73 };
  const session = createSession(doc, map.nodes, viewport);
  const restored = parseMindmapFile(JSON.parse(JSON.stringify(session)));
  assert.equal(restored.type, 'session');
  if (restored.type !== 'session') return;
  assert.deepEqual(restored.nodes, doc.nodes);
  assert.equal(restored.concept, doc.concept);
  assert.deepEqual(restored.viewport, viewport);
  const rebuilt = applySavedPositions(buildMindmap(restored), restored.positions);
  assert.deepEqual(rebuilt.nodes.map(n => [n.id, n.position]), map.nodes.map(n => [n.id, n.position]));
  assert.deepEqual(rebuilt.edges.map(e => [e.source, e.target]), map.edges.map(e => [e.source, e.target]));
  assert.equal(restored.nodes.find(n => n.id === 'manual-2')!.depth, 4);
  assert.ok(!restored.nodes.some(n => n.id === 'genre-1'));
});

test('sessions support more than 75, fewer than 75 and zero words; generation remains strict', () => {
  const initial = parseMindmapFile(sample());
  assert.equal(initial.type, 'generation'); assert.equal(initial.nodes.length, 75);
  let doc: MindmapDocument = initial;
  for (let i = 0; i < 5; i++) doc = addChild(doc, 'axis-space', `extra-${i}`, `수동 ${i}`);
  for (const input of [doc, { concept: '빈 마인드맵', nodes: [] }]) {
    const map = buildMindmap(input);
    assert.equal(parseSession(createSession(input, map.nodes, { x: 0, y: 0, zoom: 1 })).nodes.length, input.nodes.length);
  }
  assert.throws(() => parseMindmapFile({ ...sample(), nodes: [] }));
});

test('bad sessions fail without mutating the current document or graph', () => {
  const doc = parseMindmapFile(sample()), map = buildMindmap(doc);
  const current = JSON.stringify({ doc, map });
  const valid = createSession(doc, map.nodes, { x: 23, y: -45, zoom: 1.2 });
  const cases: ((d: any) => void)[] = [
    d => { d.schemaVersion = '2.0'; },
    d => { d.nodes[0].parentId = 'missing'; },
    d => { d.nodes[0].parentId = 'axis-genre'; },
    d => { d.nodes[0].depth = 2; },
    d => { d.nodes[0].id = d.nodes[1].id; },
    d => { d.positions.pop(); },
    d => { d.positions[0].id = d.positions[1].id; },
    d => { d.positions[0].id = 'unknown'; },
    d => { d.positions[0].x = null; },
    d => { d.positions[0].x = Infinity; },
    d => { d.viewport.zoom = 0; },
    d => { d.viewport.zoom = 3; },
    d => { d.viewport.x = 'bad'; },
    d => { delete d.viewport; },
  ];
  for (const mutate of cases) { const invalid = structuredClone(valid); mutate(invalid); assert.throws(() => parseSession(invalid)); }
  assert.equal(JSON.stringify({ doc, map }), current);
});

test('PNG geometry covers every card with padding at 2x, independent of pan and zoom', () => {
  const doc = parseMindmapFile(sample());
  const map = buildMindmap(doc), before = JSON.stringify(map);
  const g = exportGeometry(map.nodes);
  assert.equal(g.pixelWidth, g.width * PNG_SCALE); assert.equal(g.pixelHeight, g.height * PNG_SCALE);
  for (const n of map.nodes) {
    const x = n.position.x + g.viewport.x, y = n.position.y + g.viewport.y;
    assert.ok(x >= PNG_PADDING - 0.001 && y >= PNG_PADDING - 0.001);
    assert.ok(x + n.width! <= g.width - PNG_PADDING + 0.001 && y + n.height! <= g.height - PNG_PADDING + 0.001);
  }
  assert.equal(JSON.stringify(map), before);
  assert.throws(() => exportGeometry([{ ...map.nodes[0], width: MAX_PNG_SIDE }]));
  assert.throws(() => exportGeometry([{ ...map.nodes[0], width: 5000, height: 5000 }]));
  assert.throws(() => exportGeometry([{ ...map.nodes[0], position: { x: Infinity, y: 0 } }]));
});

test('concept filenames preserve Korean and exclude unsafe path characters', () => {
  assert.equal(conceptSlug(' 저주받은 인형 / 공장: 컨셉! '), '저주받은-인형-공장-컨셉');
  assert.equal(conceptSlug(' /:*?<> '), 'mindmap');
  assert.ok(Array.from(conceptSlug('가'.repeat(100))).length <= 64);
});
