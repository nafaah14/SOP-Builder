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

/** A photo as a JPEG blob, long edge capped — plenty for print at the sizes a page allows. */
export async function fileToPhoto(file, { maxSide = 1600, quality = 0.82 } = {}) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs/screenshots get a white page behind them
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { blob, w, h };
}

export const imageFiles = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/'));
