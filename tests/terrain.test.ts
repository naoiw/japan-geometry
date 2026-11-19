import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeElevation, getElevation, sampleElevation, JAPAN_BOUNDS, DEM_ZOOM, MESH_SEGMENTS, lonLatToTile,
  lonLatToNormalized, normalizedToLonLat, tileRange, tileKey, tileToLonLat,
  terrainSize, type HeightTiles,
} from '../src/lib/terrain.ts';

test('GSI PNG DEM decodes positive, negative and no-data heights', () => {
  assert.equal(decodeElevation(0, 39, 16), 100);
  assert.equal(decodeElevation(255, 255, 255), -0.01);
  assert.equal(decodeElevation(128, 0, 0), null);
  assert.equal(decodeElevation(0, 0, 0), 0);
});

test('Web Mercator conversion round-trips coordinates', () => {
  for (const [lon, lat] of [[139.6917, 35.6895], [127.68, 26.21], [141.35, 43.06]]) {
    const tile = lonLatToTile(lon, lat, 6);
    const back = tileToLonLat(tile.x, tile.y, 6);
    assert.ok(Math.abs(back.lon - lon) < 1e-9);
    assert.ok(Math.abs(back.lat - lat) < 1e-9);
  }
});

test('Higher XY resolution is configured consistently across mesh and tiles', () => {
  assert.equal(DEM_ZOOM, 7);
  assert.equal(MESH_SEGMENTS, 640);
  const terrainTiles = tileRange(JAPAN_BOUNDS, DEM_ZOOM);
  assert.equal(terrainTiles.length, 144);
  assert.ok(terrainTiles.some(tile => tile.x === 108 && tile.y === 50));
  assert.equal((MESH_SEGMENTS + 1) ** 2, 410881);
  const size = terrainSize();
  assert.ok(size.depth > 0 && size.width === 20);
});

test('normalization round-trips and keeps geographical north at v=0', () => {
  const sample = { lon: 138.73, lat: 35.36 };
  const normalized = lonLatToNormalized(sample.lon, sample.lat);
  const back = normalizedToLonLat(normalized.u, normalized.v);
  assert.ok(Math.abs(back.lon - sample.lon) < 1e-9);
  assert.ok(Math.abs(back.lat - sample.lat) < 1e-9);
  assert.ok(lonLatToNormalized(138, 44).v < lonLatToNormalized(138, 26).v);
});

test('elevation sample reads the corresponding pixel without invented fallbacks', () => {
  const lon = 139.6917;
  const lat = 35.6895;
  const c = lonLatToTile(lon, lat, 6);
  const x = Math.floor(c.x);
  const y = Math.floor(c.y);
  const rgba = new Uint8ClampedArray(256 * 256 * 4);
  const px = Math.floor((c.x - x) * 256);
  const py = Math.floor((c.y - y) * 256);
  const offset = (py * 256 + px) * 4;
  rgba[offset] = 0;
  rgba[offset + 1] = 39;
  rgba[offset + 2] = 16;
  const tiles: HeightTiles = new Map([[tileKey(6, x, y), { width: 256, height: 256, rgba }]]);
  assert.equal(getElevation(tiles, lon, lat, 6), 100);
  assert.deepEqual(sampleElevation(tiles, lon, lat, 6), { elevation: 100, tileAvailable: true });
  assert.deepEqual(sampleElevation(new Map(), lon, lat, 6), { elevation: null, tileAvailable: false });
  rgba[offset] = 128;
  rgba[offset + 1] = 0;
  rgba[offset + 2] = 0;
  assert.equal(getElevation(tiles, lon, lat, 6), null);
  assert.deepEqual(sampleElevation(tiles, lon, lat, 6), { elevation: null, tileAvailable: true });
  assert.equal(getElevation(new Map(), lon, lat, 6), null);
});
