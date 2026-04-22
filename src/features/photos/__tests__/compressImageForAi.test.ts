import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImageForAi } from '../compressImageForAi';

interface MockCanvasState {
  width: number;
  height: number;
  drawImageArgs: unknown[];
  convertToBlobCalls: Array<{ type: string; quality?: number }>;
}

function installCanvasMocks(convertOutput: Blob, state: MockCanvasState) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (_blob: Blob) => ({
      width: 2048,
      height: 1536,
      close: vi.fn(),
    })),
  );

  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
        state.width = w;
        state.height = h;
      }
      getContext() {
        return {
          drawImage: (...args: unknown[]) => {
            state.drawImageArgs = args;
          },
        };
      }
      async convertToBlob(options: { type: string; quality?: number }) {
        state.convertToBlobCalls.push({ type: options.type, quality: options.quality });
        return convertOutput;
      }
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('compressImageForAi', () => {
  it('resizes a 2048x1536 jpeg blob to a 1024x768 webp at quality 0.8', async () => {
    const state: MockCanvasState = {
      width: 0,
      height: 0,
      drawImageArgs: [],
      convertToBlobCalls: [],
    };
    const convertOutput = new Blob([new Uint8Array(1024 * 10)], { type: 'image/webp' });
    installCanvasMocks(convertOutput, state);

    const input = new Blob([new Uint8Array(1024 * 100)], { type: 'image/jpeg' });
    const result = await compressImageForAi(input);

    expect(state.width).toBe(1024);
    expect(state.height).toBe(768);
    expect(state.convertToBlobCalls).toHaveLength(1);
    expect(state.convertToBlobCalls[0].type).toBe('image/webp');
    expect(state.convertToBlobCalls[0].quality).toBe(0.8);
    expect(result.type).toBe('image/webp');
    expect(result.size).toBeLessThan(input.size);
  });

  it('returns image/gif inputs unchanged without calling createImageBitmap', async () => {
    const createBitmapSpy = vi.fn();
    vi.stubGlobal('createImageBitmap', createBitmapSpy);
    const gifBlob = new Blob([new Uint8Array(100)], { type: 'image/gif' });
    const result = await compressImageForAi(gifBlob);
    expect(result).toBe(gifBlob);
    expect(createBitmapSpy).not.toHaveBeenCalled();
  });

  it('returns original blob when createImageBitmap throws', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      throw new Error('decode failed');
    }));
    vi.stubGlobal('OffscreenCanvas', class {});
    const input = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    const result = await compressImageForAi(input);
    expect(result).toBe(input);
  });

  it('returns original blob when OffscreenCanvas is not available', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
      width: 2048, height: 1536, close: vi.fn(),
    })));
    vi.stubGlobal('OffscreenCanvas', undefined);
    const input = new Blob([new Uint8Array(1024)], { type: 'image/jpeg' });
    const result = await compressImageForAi(input);
    expect(result).toBe(input);
  });

  it('returns original blob when re-encoded output is not smaller than input', async () => {
    const state: MockCanvasState = { width: 0, height: 0, drawImageArgs: [], convertToBlobCalls: [] };
    const convertOutput = new Blob([new Uint8Array(1024 * 200)], { type: 'image/webp' });
    installCanvasMocks(convertOutput, state);

    const input = new Blob([new Uint8Array(1024 * 100)], { type: 'image/jpeg' });
    const result = await compressImageForAi(input);
    expect(result).toBe(input);
  });
});
