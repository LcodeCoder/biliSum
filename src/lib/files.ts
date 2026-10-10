import { layoutMindMap, renderMindMapSvg } from './mindmap';
import type { Appearance, MindMapNode } from './types';

export function safeFilename(input: string): string {
  let name = input
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .slice(0, 90)
    .replace(/[. ]+$/, '');
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    name = '_' + name;
  return name || 'biliSum';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export function downloadText(
  text: string,
  filename: string,
  mime = 'text/plain;charset=utf-8',
): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export async function downloadMapPng(
  tree: MindMapNode,
  filename: string,
  appearance: Appearance = 'light',
): Promise<void> {
  const layout = layoutMindMap(tree);
  const image = new Image();
  const url = URL.createObjectURL(
    new Blob([renderMindMapSvg(tree, appearance)], {
      type: 'image/svg+xml;charset=utf-8',
    }),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('图片导出超时，请下载 SVG 格式。')),
        10000,
      );
      image.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error('导图图片导出失败，请下载 SVG 格式。'));
      };
      image.src = url;
    });
    const scale = Math.min(2, 4096 / layout.width, 4096 / layout.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(layout.width * scale);
    canvas.height = Math.ceil(layout.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('图片导出失败，请下载 SVG 格式。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('图片编码失败，请下载 SVG 格式。')),
        'image/png',
      ),
    );
    downloadBlob(blob, filename);
  } finally {
    image.onload = image.onerror = null;
    image.src = '';
    URL.revokeObjectURL(url);
  }
}
