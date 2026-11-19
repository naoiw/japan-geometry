import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { flattenTerrainGeometry } from '../src/lib/terrainGeometry.ts';

test('0x is perfectly flat without changing original elevation or UV values', () => {
  const original = new THREE.BufferGeometry();
  original.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 3, 0,
    0, 1, 1,
    1, 2, 0,
  ], 3));
  original.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,
    0, 1,
    1, 0,
  ], 2));
  original.setIndex([0, 1, 2]);
  const flat = flattenTerrainGeometry(original);
  const heights = flat.getAttribute('position') as THREE.BufferAttribute;
  const source = original.getAttribute('position') as THREE.BufferAttribute;
  assert.deepEqual([0, 1, 2].map(i => heights.getY(i)), [0, 0, 0]);
  assert.deepEqual([0, 1, 2].map(i => source.getY(i)), [3, 1, 2]);
  const uv = flat.getAttribute('uv') as THREE.BufferAttribute;
  assert.equal(uv.getX(2), 1);

  // Unlike scale.y = 0, the flat mesh retains an invertible object transform.
  const mesh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(0.2, 1, 0.2), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(mesh);
  assert.equal(hit.length, 1);
  assert.ok(hit[0].uv);
  flat.dispose();
  original.dispose();
  mesh.material.dispose();
});
