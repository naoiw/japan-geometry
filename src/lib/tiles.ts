
import {
  JAPAN_BOUNDS, tileRange, tileKey, type HeightTiles, type TileCoord,
  type TilePixels,
} from './terrain';

const GSI_URL = 'https://cyberjapandata.gsi.go.jp/xyz/';

function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('タイルを取得できません: ' + url));
    image.src = url;
  });
}

async function concurrent<T>(
  tasks: T[],
  limit: number,
  handler: (task: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(tasks.length, limit) }, async () => {
    while (cursor < tasks.length) {
      const next = tasks[cursor++];
      await handler(next);
    }
  }));
}

function readPixels(image: HTMLImageElement): TilePixels {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2Dが利用できません');
  ctx.drawImage(image, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function demUrl(tile: TileCoord) {
  return GSI_URL + 'demgm_png/' + tile.z + '/' + tile.x + '/' + tile.y + '.png';
}

/** DEMGM is global low-resolution relief (zoom 0-8), not the higher-resolution DEM5/DEM10. */
export async function loadHeightTiles(
  zoom: number,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<{ tiles: HeightTiles; errors: number }> {
  const coords = tileRange(JAPAN_BOUNDS, zoom);
  const tiles: HeightTiles = new Map();
  let loaded = 0;
  let errors = 0;
  await concurrent(coords, 6, async (coord) => {
    if (signal.aborted) return;
    try {
      const image = await imageFromUrl(demUrl(coord));
      if (!signal.aborted) tiles.set(tileKey(coord.z, coord.x, coord.y), readPixels(image));
    } catch {
      errors++;
    } finally {
      loaded++;
      if (!signal.aborted) onProgress(loaded, coords.length);
    }
  });
  if (signal.aborted) throw new Error('読み込みを中止しました');
  if (tiles.size === 0) throw new Error('標高タイルを取得できません。通信環境または地理院サーバーを確認してください。');
  return { tiles, errors };
}

