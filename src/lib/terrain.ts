
/** Geographical coordinates, GSI DEM decoding and tile sampling (no browser dependencies). */
export const JAPAN_BOUNDS = { west: 122, east: 154, north: 47, south: 20 } as const;
export const DEM_ZOOM = 7;
/** Horizontal mesh subdivision count; shared by both dimensions. */
export const MESH_SEGMENTS = 320;
export const MODEL_WIDTH = 20;
export const HEIGHT_UNITS_PER_METRE = 0.00006;

export type Bounds = { west: number; east: number; north: number; south: number };
export type TileCoord = { z: number; x: number; y: number };
export type TilePixels = { width: number; height: number; rgba: Uint8ClampedArray };
export type HeightTiles = Map<string, TilePixels>;

export function lonLatToTile(lon: number, lat: number, zoom: number) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const rad = (clampedLat * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n;
  return { x, y };
}

export function tileToLonLat(x: number, y: number, zoom: number) {
  const n = 2 ** zoom;
  return {
    lon: (x / n) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180 / Math.PI,
  };
}

export function tileRange(bounds: Bounds, zoom: number): TileCoord[] {
  const nw = lonLatToTile(bounds.west, bounds.north, zoom);
  const se = lonLatToTile(bounds.east, bounds.south, zoom);
  const result: TileCoord[] = [];
  for (let y = Math.floor(nw.y); y <= Math.floor(se.y); y++) {
    for (let x = Math.floor(nw.x); x <= Math.floor(se.x); x++) {
      result.push({ z: zoom, x, y });
    }
  }
  return result;
}

export function tileKey(z: number, x: number, y: number): string {
  return z + '/' + x + '/' + y;
}

/** GSI PNG DEM: two's-complement 24-bit integer in centimetres, 0x800000 = no data. */
export function decodeElevation(r: number, g: number, b: number): number | null {
  const value = (r << 16) + (g << 8) + b;
  if (value === 0x800000) return null;
  return (value < 0x800000 ? value : value - 0x1000000) / 100;
}

export function getElevation(tiles: HeightTiles, lon: number, lat: number, zoom = DEM_ZOOM): number | null {
  const fractional = lonLatToTile(lon, lat, zoom);
  const x = Math.floor(fractional.x);
  const y = Math.floor(fractional.y);
  const tile = tiles.get(tileKey(zoom, x, y));
  if (!tile) return null;
  const pixelX = Math.min(tile.width - 1, Math.max(0, Math.floor((fractional.x - x) * tile.width)));
  const pixelY = Math.min(tile.height - 1, Math.max(0, Math.floor((fractional.y - y) * tile.height)));
  const index = (pixelY * tile.width + pixelX) * 4;
  return decodeElevation(tile.rgba[index], tile.rgba[index + 1], tile.rgba[index + 2]);
}

export function terrainSize(bounds: Bounds = JAPAN_BOUNDS) {
  const nw = lonLatToTile(bounds.west, bounds.north, 0);
  const se = lonLatToTile(bounds.east, bounds.south, 0);
  return { width: MODEL_WIDTH, depth: MODEL_WIDTH * (se.y - nw.y) / (se.x - nw.x) };
}

export function normalizedToLonLat(u: number, v: number, bounds: Bounds = JAPAN_BOUNDS) {
  const nw = lonLatToTile(bounds.west, bounds.north, 0);
  const se = lonLatToTile(bounds.east, bounds.south, 0);
  return tileToLonLat(nw.x + (se.x - nw.x) * u, nw.y + (se.y - nw.y) * v, 0);
}

export function lonLatToNormalized(lon: number, lat: number, bounds: Bounds = JAPAN_BOUNDS) {
  const nw = lonLatToTile(bounds.west, bounds.north, 0);
  const se = lonLatToTile(bounds.east, bounds.south, 0);
  const p = lonLatToTile(lon, lat, 0);
  return { u: (p.x - nw.x) / (se.x - nw.x), v: (p.y - nw.y) / (se.y - nw.y) };
}

export function pointOnTerrain(lon: number, lat: number, elevation = 0) {
  const size = terrainSize();
  const { u, v } = lonLatToNormalized(lon, lat);
  return {
    x: (u - 0.5) * size.width,
    y: Math.max(0, elevation) * HEIGHT_UNITS_PER_METRE,
    z: (v - 0.5) * size.depth,
  };
}
