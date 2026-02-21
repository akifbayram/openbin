import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { resolveIcon } from '@/lib/iconMap';

/**
 * Render lucide-react icon components to PNG data URLs via offscreen DOM + canvas.
 * Deduplicates by icon name, silently skips on failure.
 */
export async function batchRenderIconDataURLs(
  iconNames: string[],
  sizePx: number = 128,
): Promise<Map<string, string>> {
  const unique = [...new Set(iconNames)];
  const results = new Map<string, string>();

  for (const name of unique) {
    try {
      const dataUrl = await renderIconToDataUrl(name, sizePx);
      if (dataUrl) results.set(name, dataUrl);
    } catch {
      // silently skip failed icons
    }
  }

  return results;
}

async function renderIconToDataUrl(iconName: string, sizePx: number): Promise<string | null> {
  const Icon = resolveIcon(iconName);
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const root = createRoot(container);
    flushSync(() => {
      root.render(createElement(Icon, { width: sizePx, height: sizePx, color: '#000000' }));
    });

    const svg = container.querySelector('svg');
    if (!svg) return null;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const dataUrl = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = sizePx;
        canvas.height = sizePx;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

    URL.revokeObjectURL(url);
    root.unmount();
    return dataUrl;
  } finally {
    document.body.removeChild(container);
  }
}
