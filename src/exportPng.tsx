import { createRoot } from 'react-dom/client';
import { ReactFlow } from '@xyflow/react';
import { toBlob } from 'html-to-image';
import { NodeCard } from './NodeCard';
import type { buildMindmap } from './domain/mindmap';
import { exportGeometry, PNG_SCALE } from './domain/exportGeometry';

const nodeTypes = { mindmap: NodeCard };
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export async function exportPng(map: ReturnType<typeof buildMindmap>): Promise<Blob> {
  const geometry = exportGeometry(map.nodes);
  await document.fonts.ready;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true'); host.inert = true;
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none' });
  const stage = document.createElement('div'); stage.className = 'png-stage';
  // Keep the captured element's own coordinate system at (0,0). Offscreen
  // positioning belongs on its parent, outside the DOM-to-image snapshot.
  Object.assign(stage.style, { position: 'relative', width: `${geometry.width}px`, height: `${geometry.height}px`, background: 'transparent' });
  host.append(stage); document.body.append(host);
  const root = createRoot(stage);
  try {
    root.render(<ReactFlow nodes={map.nodes.map(n => ({ ...n, selected: false }))}
      edges={map.edges.map(e => ({ ...e, selected: false }))} nodeTypes={nodeTypes}
      defaultViewport={geometry.viewport} minZoom={0.01} maxZoom={2.5}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      nodesFocusable={false} edgesFocusable={false} onlyRenderVisibleElements={false}
      panOnDrag={false} zoomOnScroll={false} zoomOnDoubleClick={false}
      colorMode="dark" proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }} />);
    const deadline = performance.now() + 10_000;
    while (stage.querySelectorAll('.react-flow__node').length !== map.nodes.length || stage.querySelectorAll('.react-flow__edge-path').length !== map.edges.length) {
      if (performance.now() > deadline) throw new Error('PNG용 전체 노드·연결선 렌더링을 완료하지 못했습니다.');
      await new Promise(resolve => window.setTimeout(resolve, 25));
    }
    await frame(); await frame();
    const blob = await toBlob(stage, {
      width: geometry.width, height: geometry.height, pixelRatio: PNG_SCALE, skipAutoScale: true,
      filter: node => !(node instanceof Element && (node.classList.contains('react-flow__handle') || node.classList.contains('react-flow__edge-interaction'))),
    });
    if (!blob || !blob.size || blob.type !== 'image/png') throw new Error('브라우저가 PNG 이미지를 생성하지 못했습니다. 이미지 크기나 메모리 한도를 확인해주세요.');
    const image = await createImageBitmap(blob);
    try {
      if (image.width !== geometry.pixelWidth || image.height !== geometry.pixelHeight) throw new Error('브라우저 이미지 크기 제한으로 PNG가 축소되거나 잘렸습니다.');
      const probe = document.createElement('canvas'); probe.width = 1; probe.height = 1;
      const context = probe.getContext('2d');
      if (!context) throw new Error('브라우저가 PNG 검사용 캔버스를 생성하지 못했습니다.');
      context.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
      if (context.getImageData(0, 0, 1, 1).data[3] !== 0) throw new Error('PNG 배경을 투명하게 생성하지 못했습니다.');
      for (const node of map.nodes) {
        context.clearRect(0, 0, 1, 1);
        const x = (node.position.x + node.width! / 2 + geometry.viewport.x) * PNG_SCALE;
        const y = (node.position.y + node.height! / 2 + geometry.viewport.y) * PNG_SCALE;
        context.drawImage(image, x, y, 1, 1, 0, 0, 1, 1);
        if (context.getImageData(0, 0, 1, 1).data[3] === 0) throw new Error(`브라우저가 노드 ${node.id}를 이미지에 포함하지 못했습니다.`);
      }
    } finally { image.close(); }
    return blob;
  } catch (error) {
    throw new Error(`PNG 저장 실패: ${error instanceof Error ? error.message : '브라우저 이미지 크기 또는 메모리 한도를 확인해주세요.'}`);
  } finally { root.unmount(); host.remove(); }
}
