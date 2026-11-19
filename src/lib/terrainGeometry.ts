import * as THREE from 'three';

/**
 * Terrain vertex classes:
 * 0 = source tile not loaded, 1 = sea / no-data within a loaded tile,
 * 2 = positive terrain elevation.
 *
 * A shoreline triangle needs only one land vertex; requiring all three to be
 * land removes a full mesh-cell strip around the coastline and can disconnect
 * narrow peninsulas. Never span an entirely unavailable (failed) tile.
 */
export function shouldDrawTerrainTriangle(a: number, b: number, c: number): boolean {
  return a !== 0 && b !== 0 && c !== 0 && (a === 2 || b === 2 || c === 2);
}


/**
 * Flatten vertex heights without mutating the original terrain.
 * Preserves UVs, indices and vertex colors, so point picking still works at 0x.
 */
export function flattenTerrainGeometry(original: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = original.clone();
  const position = flat.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, 0);
  }
  position.needsUpdate = true;
  flat.computeVertexNormals();
  flat.computeBoundingBox();
  flat.computeBoundingSphere();
  return flat;
}
