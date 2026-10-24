/**
 * Everything an export needs beyond the layout itself, fetched only when the
 * document actually uses it: the DejaVu fonts (~1.4MB) for symbols Helvetica
 * lacks, and photos stored outside the document.
 */
let fontsP = null;

const toBase64 = async (blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

function loadFonts() {
  if (!fontsP) {
    fontsP = Promise.all(['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map((f) => fetch(`/fonts/${f}`).then((r) => {
      if (!r.ok) throw new Error(`font ${f}: ${r.status}`);
      return r.blob();
    }).then(toBase64)))
      .then(([normal, bold]) => ({ normal, bold }))
      .catch((e) => { fontsP = null; throw e; });
  }
  return fontsP;
}

export async function exportAssets(result, { loadImage } = {}) {
  const assets = {};
  if (result.usesFallback) assets.fonts = await loadFonts();
  const ids = new Set();
  for (const p of result.pages) for (const b of p.boxes) if (b.t === 'image' && b.imageId) ids.add(b.imageId);
  if (ids.size && loadImage) {
    assets.images = {};
    await Promise.all([...ids].map(async (id) => { assets.images[id] = await loadImage(id); }));
  }
  return assets;
}
