import { compressBlobImage } from './compressImage';

export function compressImageForAi(file: Blob): Promise<Blob> {
  return compressBlobImage(file, {
    maxDimension: 1024,
    quality: 0.8,
    outputType: 'image/webp',
  });
}
