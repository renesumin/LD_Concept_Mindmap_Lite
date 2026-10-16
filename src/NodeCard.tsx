import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import type { MindmapNode } from './domain/mindmap';
import { characterCount } from './domain/editing';

export interface EditorState { id: string; draft: string; error: string; isNew: boolean }
export const EditingContext = createContext<{
  editor: EditorState | null;
  start: (id: string) => void;
  change: (text: string) => void;
  confirm: () => void;
  cancel: () => void;
}>({ editor: null, start: () => {}, change: () => {}, confirm: () => {}, cancel: () => {} });

export function NodeCard({ id, data, selected }: NodeProps<MindmapNode>) {
  const editing = useContext(EditingContext);
  const editor = editing.editor?.id === id ? editing.editor : null;
  const input = useRef<HTMLTextAreaElement>(null);
  const updateInternals = useUpdateNodeInternals();
  useLayoutEffect(() => { updateInternals(id); }, [id, data.ports, updateInternals]);
  useLayoutEffect(() => {
    if (editor && input.current) { input.current.focus({ preventScroll: true }); }
  }, [!!editor]);
  useLayoutEffect(() => {
    if (editor && input.current) {
      input.current.style.height = 'auto';
      input.current.style.height = `${input.current.scrollHeight + 2}px`;
    }
  }, [editor?.draft]);
  return <div className={`map-node ${data.kind}${selected ? ' is-selected' : ''}`}
    style={{ '--axis-color': data.color } as CSSProperties}
    onDoubleClick={event => { event.stopPropagation(); if (data.kind !== 'axis') editing.start(id); }}>
    {data.ports.map(port => <Handle key={port.id} id={port.id} type={port.type} position={port.side}
      style={port.side === Position.Left || port.side === Position.Right ? { top: `${port.offset}%` } : { left: `${port.offset}%` }} />)}
    <span className="node-caption">{data.subtitle}</span>
    {editor ? <div className="node-editor nodrag nowheel nopan" onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
      <textarea ref={input} aria-label={data.kind === 'concept' ? '컨셉 문장 편집' : '단어 편집'} value={editor.draft} rows={1}
        onChange={e => editing.change(e.target.value)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter') { e.preventDefault(); editing.confirm(); }
          if (e.key === 'Escape') { e.preventDefault(); editing.cancel(); }
        }} />
      <span className="edit-help">{data.kind === 'word' ? `${characterCount(editor.draft.trim())}/15 · ` : ''}Enter 확정 · Esc 취소</span>
      {editor.error && <span role="alert" className="edit-error">{editor.error}</span>}
      <div className="edit-actions"><button onClick={editing.confirm}>확정</button><button onClick={editing.cancel}>취소</button></div>
    </div> : <strong title={data.label}>{data.label}</strong>}
  </div>;
}
