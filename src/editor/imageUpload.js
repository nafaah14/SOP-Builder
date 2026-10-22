/**
 * Read an image file and downscale it so its long edge is at most `maxSide`.
 * PNG keeps logo transparency; JPEG is smaller for photos.
 */
export async function fileToImage(file, { maxSide = 600, type = 'image/png', quality = 0.9 } = {}) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return { dataUrl: canvas.toDataURL(type, quality), w, h };
}
