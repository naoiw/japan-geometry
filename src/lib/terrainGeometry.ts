import * as THREE from 'three';

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
