import type { MindmapNode } from './mindmap';

export const PNG_SCALE = 2;
export const PNG_PADDING = 64;
// Conservative cross-browser / memory budget; never silently downsample or crop.
export const MAX_PNG_SIDE = 16384;
export const MAX_PNG_PIXELS = 64_000_000;
export function exportGeometry(nodes: MindmapNode[]) {
  if (!nodes.length) throw new Error('내보낼 노드가 없습니다.');
  const x = Math.min(...nodes.map(n => n.position.x));
  const y = Math.min(...nodes.map(n => n.position.y));
  const width = Math.ceil(Math.max(...nodes.map(n => n.position.x + n.width!)) - x + PNG_PADDING * 2);
  const height = Math.ceil(Math.max(...nodes.map(n => n.position.y + n.height!)) - y + PNG_PADDING * 2);
  const pixelWidth = width * PNG_SCALE, pixelHeight = height * PNG_SCALE;
  if (![x, y, width, height, pixelWidth, pixelHeight].every(Number.isFinite) || width <= 0 || height <= 0 || pixelWidth > MAX_PNG_SIDE || pixelHeight > MAX_PNG_SIDE || pixelWidth * pixelHeight > MAX_PNG_PIXELS) {
    throw new Error('전체 마인드맵이 2배 PNG 출력 한도를 초과합니다(한 변 16,384px / 총 6,400만 픽셀). 노드를 줄인 뒤 다시 시도해주세요.');
  }
  return { width, height, pixelWidth, pixelHeight, viewport: { x: PNG_PADDING - x, y: PNG_PADDING - y, zoom: 1 } };
}
