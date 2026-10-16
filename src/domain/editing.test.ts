import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMindmap, parseGeneration, NODE_GAP, type MindmapDocument } from './mindmap';
import { addChild, characterCount, deleteBranch, descendantIds, draftChild, renameNode, validateWordText } from './editing';

const sample = () => parseGeneration(JSON.parse(readFileSync(new URL('../../public/sample-generation.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '')));
const relations = (doc: MindmapDocument) => doc.nodes.map(n => [n.id,n.parentId,n.axis,n.depth]);

test('rename preserves all relationships, IDs, original data and unrestricted concept text', () => {
  const original = sample();
  const snapshot = JSON.stringify(original);
  let edited = renameNode(original, 'era-1', '새로운 시대');
  assert.deepEqual(relations(edited), relations(original));
  edited = renameNode(edited, 'concept', '길이 제한 없는 컨셉 문장 '.repeat(30));
  assert.ok(characterCount(edited.concept) > 15);
  assert.deepEqual(relations(edited), relations(original));
  assert.equal(JSON.stringify(original), snapshot);
  const oldEdges = buildMindmap(original).edges.map(e => [e.source,e.target]);
  assert.deepEqual(buildMindmap(edited).edges.map(e => [e.source,e.target]), oldEdges);
  assert.throws(() => renameNode(edited, 'axis-era', '새 축'));
});

test('word validation rejects blank, over 15 characters and cross-axis duplicates', () => {
  const doc = sample();
  for (const text of ['', '   \n\t', '가'.repeat(16), doc.nodes.find(n => n.axis === 'genre')!.text]) {
    assert.throws(() => renameNode(doc, 'era-1', text));
    assert.throws(() => addChild(doc, 'axis-era', 'new-test', text));
  }
  assert.equal(validateWordText(doc, '가'.repeat(15)), '가'.repeat(15));
  assert.equal(validateWordText(doc, '  새 단어  '), '새 단어');
  assert.equal(renameNode(doc, 'era-1', doc.nodes[0].text).nodes[0].text, doc.nodes[0].text);
  assert.throws(() => validateWordText(doc, `  ${doc.nodes[0].text}  `));
  assert.equal(characterCount('👩‍🚀'), 1);
  assert.equal(characterCount('가'), 1);
  const normalized = { ...doc, nodes: [{ ...doc.nodes[0], text: '가' }] };
  assert.throws(() => validateWordText(normalized, '가'));
  assert.throws(() => renameNode(doc, 'concept', ' '));
});

test('children inherit parent axis/depth with no manual depth or count limit', () => {
  let doc: MindmapDocument = sample();
  const snapshot = JSON.stringify(doc);
  const draft = draftChild(doc, 'axis-element', 'new-draft');
  assert.deepEqual(draft, { id: 'new-draft', parentId: 'axis-element', axis: 'element', depth: 1, text: '' });
  assert.equal(JSON.stringify(doc), snapshot);
  doc = addChild(doc, 'axis-element', 'manual-1', '수동 단어 1');
  for (let depth=2;depth<=12;depth++) doc=addChild(doc, `manual-${depth-1}`, `manual-${depth}`, `수동 단어 ${depth}`);
  const last=doc.nodes.find(n=>n.id==='manual-12')!;
  assert.equal(last.axis,'element'); assert.equal(last.depth,12); assert.equal(last.parentId,'manual-11');
  assert.equal(doc.nodes.length,87);
  for(const parent of ['concept','missing']) assert.throws(()=>draftChild(doc,parent,'new-id'));
  for(const id of ['concept','axis-era','era-1']) assert.throws(()=>draftChild(doc,'axis-era',id));
  const map=buildMindmap(doc);
  assert.equal(map.nodes.length,93); assert.equal(map.edges.length,92);
  for(const n of doc.nodes) assert.equal(map.edges.find(e=>e.target===n.id)!.source,n.parentId);
  for(let i=0;i<map.nodes.length;i++)for(let j=i+1;j<map.nodes.length;j++) {
    const a=map.nodes[i],b=map.nodes[j];
    const x=Math.max(b.position.x-a.position.x-a.width!,a.position.x-b.position.x-b.width!);
    const y=Math.max(b.position.y-a.position.y-a.height!,a.position.y-b.position.y-b.height!);
    assert.ok(x>=NODE_GAP-.001||y>=NODE_GAP-.001,`${a.id} overlaps ${b.id}`);
  }
});

test('deleting a parent removes exactly its descendants and all incident edges', () => {
  let doc: MindmapDocument = sample();
  doc=addChild(doc,'era-4','deep-1','수동 자손');
  doc=addChild(doc,'deep-1','deep-2','수동 손자');
  const snapshot=JSON.stringify(doc);
  const expected=new Set(['era-1','era-4','era-5','era-6','era-7','deep-1','deep-2']);
  assert.deepEqual(descendantIds(doc,'era-1'),expected);
  const result=deleteBranch(doc,'era-1');
  assert.deepEqual(result.nodes,doc.nodes.filter(n=>!expected.has(n.id)));
  assert.equal(JSON.stringify(doc),snapshot);
  const map=buildMindmap(result);
  assert.equal(map.nodes.length,result.nodes.length+6);
  assert.ok(map.edges.every(e=>!expected.has(e.source)&&!expected.has(e.target)));
  for(const n of result.nodes) assert.equal(map.edges.find(e=>e.target===n.id)!.source,n.parentId);
  assert.equal(deleteBranch(doc,'deep-2').nodes.length,doc.nodes.length-1);
  for(const id of ['concept','axis-era','axis-genre','axis-action','axis-space','axis-element','missing']) assert.throws(()=>deleteBranch(doc,id));
});

test('empty axes remain after removing all words and can accept new children', () => {
  let doc: MindmapDocument = sample();
  for (const root of doc.nodes.filter(n => n.depth === 1)) doc = deleteBranch(doc, root.id);
  assert.equal(doc.nodes.length, 0);
  const emptyMap = buildMindmap(doc);
  assert.equal(emptyMap.nodes.length, 6); assert.equal(emptyMap.edges.length, 5);
  doc = addChild(doc, 'axis-space', 'restart', '다시 시작');
  assert.equal(doc.nodes[0].axis, 'space'); assert.equal(doc.nodes[0].depth, 1);
  assert.equal(buildMindmap(doc).edges.find(e => e.target === 'restart')!.source, 'axis-space');
});
