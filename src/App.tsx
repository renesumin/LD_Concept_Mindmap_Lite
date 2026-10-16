import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Background, Controls, ReactFlow, type ReactFlowInstance, type Viewport } from '@xyflow/react';
import { buildMindmap, type MindmapDocument, type MindmapNode, type Word } from './domain/mindmap';
import { axes } from './domain/mindmap';
import { addChild, deleteBranch, descendantIds, draftChild, renameNode } from './domain/editing';
import { applySavedPositions, conceptSlug, createSession, parseMindmapFile, type SavedPosition } from './domain/session';
import { downloadBlob } from './download';
import { exportPng } from './exportPng';
import { measureEditingNode, measureNode } from './measureNode';
import { EditingContext, NodeCard, type EditorState } from './NodeCard';

const nodeTypes = { mindmap: NodeCard };
export default function App() {
  const [doc, setDoc] = useState<MindmapDocument | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pending, setPending] = useState<Word | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedPositions, setSavedPositions] = useState<SavedPosition[] | null>(null);
  const [initialViewport, setInitialViewport] = useState<Viewport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadEpoch, setLoadEpoch] = useState(0);
  const flow = useRef<ReactFlowInstance<MindmapNode> | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  const map = useMemo(() => {
    if (!doc) return null;
    let visible: MindmapDocument = pending ? { ...doc, nodes: [...doc.nodes, pending] } : doc;
    if (editor) visible = editor.id === 'concept' ? { ...visible, concept: editor.draft || ' ' }
      : { ...visible, nodes: visible.nodes.map(n => n.id === editor.id ? { ...n, text: editor.draft || ' ' } : n) };
    const layout = buildMindmap(visible, (label, subtitle, kind, id) => editor?.id === id
      ? measureEditingNode(label, subtitle, kind, editor.draft, editor.error)
      : measureNode(label, subtitle, kind, id));
    return savedPositions && !pending && !editor ? applySavedPositions(layout, savedPositions) : layout;
  }, [doc, pending, editor, savedPositions]);
  const selectedNode = map?.nodes.find(n => n.id === selected);
  const canAdd = selectedNode && selectedNode.data.kind !== 'concept';
  const canDelete = selectedNode?.data.kind === 'word';

  // Preserve zoom and pan for all edits. Only pan a newly added card into view
  // when it would otherwise be completely outside the current canvas.
  const pendingId = pending?.id;
  useLayoutEffect(() => {
    if (!pendingId || !map || !flow.current || !canvas.current) return;
    const node = map.nodes.find(n => n.id === pendingId)!;
    const view = flow.current.getViewport();
    const { width, height } = canvas.current.getBoundingClientRect();
    const left = node.position.x * view.zoom + view.x, top = node.position.y * view.zoom + view.y;
    if (left + node.width! * view.zoom < 0 || left > width || top + node.height! * view.zoom < 0 || top > height) {
      void flow.current.setViewport({ zoom: view.zoom, x: width / 2 - (node.position.x + node.width! / 2) * view.zoom,
        y: height / 2 - (node.position.y + node.height! / 2) * view.zoom });
    }
  }, [pendingId]);

  async function load(file: File) {
    const current = ++request.current;
    setError(''); setLoading(true);
    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
      const result = parseMindmapFile(raw);
      if (result.type === 'generation' && file.size > 5 * 1024 * 1024) throw new Error('generation JSON은 5MB 이하의 파일을 선택해주세요.');
      await document.fonts.ready;
      const checked = buildMindmap(result, measureNode);
      if (result.type === 'session') applySavedPositions(checked, result.positions);
      if (current !== request.current) return;
      setSavedPositions(result.type === 'session' ? result.positions : null);
      setInitialViewport(result.type === 'session' ? result.viewport : null);
      setDoc(result); setSelected(null); setEditor(null); setPending(null);
      setFilename(file.name); setLoadEpoch(n => n + 1);
    } catch (e) {
      if (current === request.current) setError(e instanceof SyntaxError ? 'JSON 문법이 올바르지 않습니다. 쉼표와 따옴표를 확인해주세요.' : e instanceof Error ? e.message : '파일을 읽을 수 없습니다.');
    } finally { if (current === request.current) setLoading(false); }
  }
  function startEditing(id: string) {
    if (!doc || editor || loading || exporting) return;
    const text = id === 'concept' ? doc.concept : doc.nodes.find(n => n.id === id)?.text;
    if (text === undefined) return;
    setSelected(id); setEditor({ id, draft: text, error: '', isNew: false });
  }
  function changeDraft(draft: string) { setEditor(current => current ? { ...current, draft, error: '' } : null); }
  function confirmEdit() {
    if (!doc || !editor) return;
    try {
      const updated = pending ? addChild(doc, pending.parentId, pending.id, editor.draft) : renameNode(doc, editor.id, editor.draft);
      setSavedPositions(null); setDoc(updated); setEditor(null); setPending(null); setError('');
    } catch (e) { setEditor({ ...editor, error: e instanceof Error ? e.message : '수정할 수 없습니다.' }); }
  }
  function cancelEdit() {
    if (pending) setSelected(pending.parentId);
    setPending(null); setEditor(null);
  }
  function beginAdd() {
    if (!doc || !selected || !canAdd || editor) return;
    try {
      const node = draftChild(doc, selected, `manual-${crypto.randomUUID()}`);
      setPending(node); setSelected(node.id); setEditor({ id: node.id, draft: '', error: '', isNew: true });
    } catch (e) { setError(e instanceof Error ? e.message : '추가할 수 없습니다.'); }
  }
  function removeSelected() {
    if (!doc || !selected || !canDelete || editor) return;
    const word = doc.nodes.find(n => n.id === selected)!;
    const count = descendantIds(doc, selected).size;
    if (!window.confirm(`“${word.text}” 노드${count > 1 ? `와 하위 자손 ${count - 1}개` : ''}를 삭제할까요?`)) return;
    setSavedPositions(null); setDoc(deleteBranch(doc, selected)); setSelected(null);
  }
  function saveSession() {
    if (!doc || !map || !flow.current || editor || exporting || loading) return;
    try {
      const session = createSession(doc, map.nodes, flow.current.getViewport());
      downloadBlob(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json;charset=utf-8' }), `${conceptSlug(doc.concept)}_session.json`);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '세션 저장에 실패했습니다.'); }
  }
  async function savePng() {
    if (!doc || !map || editor || exporting || loading) return;
    setExporting(true); setError('');
    try {
      const blob = await exportPng(map);
      downloadBlob(blob, `${conceptSlug(doc.concept)}_mindmap.png`);
    } catch (e) { setError(e instanceof Error ? e.message : 'PNG 저장에 실패했습니다.'); }
    finally { setExporting(false); }
  }
  return <EditingContext.Provider value={{ editor, start: startEditing, change: changeDraft, confirm: confirmEdit, cancel: cancelEdit }}><main className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-icon">✳</span><div><h1>LD Concept <span>Mindmap Lite</span></h1><p>레벨 디자인 아이디어를 한눈에 연결하세요</p></div></div>
      <div className="file-actions">
        <button disabled={!doc || loading || !!editor || exporting} onClick={saveSession}>세션 저장</button>
        <button disabled={!doc || loading || !!editor || exporting} onClick={() => void savePng()}>{exporting ? 'PNG 생성 중…' : 'PNG 저장'}</button>
      <label className={`upload ${loading ? 'busy' : ''}`}><span>＋</span> {loading ? '불러오는 중…' : 'JSON 불러오기'}<input type="file" accept=".json,application/json" disabled={loading || !!editor || exporting} onChange={e => { const file = e.target.files?.[0]; if (file) void load(file); e.target.value = ''; }} /></label></div>
    </header>
    <section className="workspace">
      <div className="canvas-bar"><span className="status-dot"/><span>{filename || '새 컨셉을 기다리고 있어요'}</span><span className="file-meta">{doc ? `${doc.nodes.length} WORDS · 5 AXES` : 'GENERATION / 1.0'}</span></div>
      {error && <div role="alert" className="error">{error}<button aria-label="오류 닫기" onClick={() => setError('')}>×</button></div>}
      {doc && <div className="edit-toolbar">
        <span className="selection-label">{selectedNode ? `선택: ${selectedNode.data.label}` : '노드 선택 · 더블클릭으로 텍스트 수정'}</span>
        <button disabled={!canAdd || !!editor || loading || exporting} onClick={beginAdd}>＋ 하위 노드 추가</button>
        <button className="delete-button" disabled={!canDelete || !!editor || loading || exporting} onClick={removeSelected}>노드 삭제</button>
      </div>}
      <div className="canvas" ref={canvas}>
        {map ? <ReactFlow<MindmapNode> key={loadEpoch} nodes={map.nodes.map(n => ({ ...n, selected: n.id === selected }))} edges={map.edges} nodeTypes={nodeTypes} onInit={instance => { flow.current = instance; }} defaultViewport={initialViewport ?? undefined} fitView={!initialViewport} fitViewOptions={{ padding: 0.15 }} minZoom={0.01} maxZoom={2.5} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} elementsSelectable={!editor} nodesFocusable={!editor} edgesFocusable={false}
          onNodeClick={(_event, node) => { if (!editor) setSelected(node.id); }}
          onPaneClick={() => { if (!editor) setSelected(null); }}
          zoomOnDoubleClick={false} panOnDrag={!editor} zoomOnScroll={!editor} zoomOnPinch={!editor}
          panActivationKeyCode={null} zoomActivationKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null} deleteKeyCode={null} colorMode="dark" onlyRenderVisibleElements>
          <Background color="#343b50" gap={24}/>{!editor && <Controls showInteractive={false}/>}
        </ReactFlow> : <><div className="dot-grid"/><div className="empty-state"><div className="empty-orbit">✳</div><p className="eyebrow">FROM WORDS TO WORLDS</p><h2>컨셉의 연결을 발견하세요.</h2><p>Antigravity에서 생성한 JSON을 불러오면<br/>75개의 단어가 5개 축의 마인드맵으로 펼쳐집니다.</p><a href={`${import.meta.env.BASE_URL}sample-generation.json`} download>샘플 JSON 다운로드 <span>↗</span></a><span className="privacy">로컬 파일 처리 · 서버 전송 없음</span></div></>}
      </div>
      <footer><div className="legend">{axes.map(a => <span key={a.id}><i style={{ background: a.color }}/>{a.label}</span>)}</div><span className="hint">{editor ? 'Enter 확정 · Esc 취소' : '드래그로 이동 · 휠로 확대/축소'}{map && <button disabled={!!editor} onClick={() => void flow.current?.fitView({ padding: 0.15, duration: 400 })}>전체 보기 ↗</button>}</span></footer>
    </section>
  </main></EditingContext.Provider>;
}
