
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  DEM_ZOOM, MESH_SEGMENTS, HEIGHT_UNITS_PER_METRE, getElevation,
  normalizedToLonLat, terrainSize, type HeightTiles,
} from '../lib/terrain';
import { loadHeightTiles } from '../lib/tiles';

export type PickedPoint = { longitude: number; latitude: number; elevation: number };

type Props = {
  exaggeration: number;
  onProgress: (loaded: number, total: number) => void;
  onReady: (failed: number) => void;
  onError: (message: string) => void;
  onPick: (point: PickedPoint) => void;
};

const COLUMN_COUNT = MESH_SEGMENTS;
const ROW_COUNT = MESH_SEGMENTS;

const COLOR_STOPS: readonly (readonly [number, THREE.Color])[] = [
  [0, new THREE.Color('#3b8c76')],
  [200, new THREE.Color('#72a37a')],
  [550, new THREE.Color('#a0a47d')],
  [1100, new THREE.Color('#c0a078')],
  [1900, new THREE.Color('#a48677')],
  [2800, new THREE.Color('#d3c5ac')],
  [3900, new THREE.Color('#f1ede0')],
];
const MISSING_COLOR = new THREE.Color('#203241');
const OCEAN_COLOR = new THREE.Color('#16465a');

function colorForElevation(elevation: number | null): THREE.Color {
  if (elevation === null) return MISSING_COLOR;
  if (elevation <= 0) return OCEAN_COLOR;
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (elevation <= COLOR_STOPS[i][0]) {
      const t = (elevation - COLOR_STOPS[i - 1][0]) / (COLOR_STOPS[i][0] - COLOR_STOPS[i - 1][0]);
      return COLOR_STOPS[i - 1][1].clone().lerp(COLOR_STOPS[i][1], t);
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1][1];
}

function buildGeometry(tiles: HeightTiles): THREE.BufferGeometry {
  const size = terrainSize();
  const points: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const valid: boolean[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= ROW_COUNT; row++) {
    const v = row / ROW_COUNT;
    for (let column = 0; column <= COLUMN_COUNT; column++) {
      const u = column / COLUMN_COUNT;
      const location = normalizedToLonLat(u, v);
      const elevation = getElevation(tiles, location.lon, location.lat);
      const color = colorForElevation(elevation);
      points.push((u - 0.5) * size.width, elevation === null ? 0 : Math.max(0, elevation) * HEIGHT_UNITS_PER_METRE, (v - 0.5) * size.depth);
      colors.push(color.r, color.g, color.b);
      uvs.push(u, 1 - v);
      valid.push(elevation !== null);
    }
  }
  const stride = COLUMN_COUNT + 1;
  for (let row = 0; row < ROW_COUNT; row++) {
    for (let column = 0; column < COLUMN_COUNT; column++) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // +Y winding: the world-map north edge is at negative Z.
      if (valid[a] && valid[c] && valid[b]) indices.push(a, c, b);
      if (valid[b] && valid[c] && valid[d]) indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function TerrainScene({
  exaggeration, onProgress, onReady, onError, onPick,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const canvasState = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    mesh: THREE.Mesh | null;
    elevationMaterial: THREE.MeshStandardMaterial;
  } | null>(null);
  const tilesRef = useRef<HeightTiles | null>(null);
  const [terrainReady, setTerrainReady] = useState(false);
  const latestHandlers = useRef({ onProgress, onReady, onError, onPick });
  latestHandlers.current = { onProgress, onReady, onError, onPick };

  useEffect(() => {
    const element = mount.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      latestHandlers.current.onError('WebGLを初期化できません。ブラウザのGPU設定を確認してください。');
      return;
    }

    const controller = new AbortController();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor('#06101b', 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 160);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.minDistance = 4;
    controls.maxDistance = 85;
    controls.minPolarAngle = 0.17;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0, 0);
    camera.position.set(8, 22, 29);

    const light = new THREE.DirectionalLight('#fff2dc', 2.45);
    light.position.set(-9, 17, -12);
    scene.add(light);
    scene.add(new THREE.AmbientLight('#b6dce7', 1.45));
    const hemisphere = new THREE.HemisphereLight('#a7d9f5', '#1c3040', 0.75);
    scene.add(hemisphere);
    const size = terrainSize();
    const oceanMaterial = new THREE.MeshStandardMaterial({ color: '#10293b', metalness: 0.23, roughness: 0.8 });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(size.width + 0.7, size.depth + 0.7), oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.045;
    scene.add(ocean);
    const grid = new THREE.GridHelper(24, 24, '#285367', '#123449');
    grid.position.y = -0.06;
    scene.add(grid);

    const elevationMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 0.92, metalness: 0,
    });
    canvasState.current = { scene, renderer, camera, controls, mesh: null, elevationMaterial };

    const resize = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    const pointer = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const cursor = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) return;
      const mesh = canvasState.current?.mesh;
      const tiles = tilesRef.current;
      if (!mesh || !tiles) return;
      const rect = renderer.domElement.getBoundingClientRect();
      cursor.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(cursor, camera);
      const hit = raycaster.intersectObject(mesh)[0];
      if (!hit?.uv) return;
      const coord = normalizedToLonLat(hit.uv.x, 1 - hit.uv.y);
      const elevation = getElevation(tiles, coord.lon, coord.lat);
      if (elevation !== null) {
        latestHandlers.current.onPick({ longitude: coord.lon, latitude: coord.lat, elevation });
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    let animationId = 0;
    const renderFrame = () => {
      controls.update();
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    void loadHeightTiles(DEM_ZOOM, (count, total) => latestHandlers.current.onProgress(count, total), controller.signal)
      .then(({ tiles, errors }) => {
        if (controller.signal.aborted) return;
        tilesRef.current = tiles;
        const mesh = new THREE.Mesh(buildGeometry(tiles), elevationMaterial);
        mesh.scale.y = exaggeration;
        scene.add(mesh);
        if (canvasState.current) canvasState.current.mesh = mesh;
        setTerrainReady(true);
        latestHandlers.current.onReady(errors);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) latestHandlers.current.onError(error instanceof Error ? error.message : '標高データを取得できません');
      });

    return () => {
      controller.abort();
      window.cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      const mesh = canvasState.current?.mesh;
      mesh?.geometry.dispose();
      elevationMaterial.dispose();
      ocean.geometry.dispose();
      oceanMaterial.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      element.removeChild(renderer.domElement);
      canvasState.current = null;
      tilesRef.current = null;
    };
    // Terrain is fetched once per mount. Live handlers are updated via latestHandlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mesh = canvasState.current?.mesh;
    if (mesh) mesh.scale.y = exaggeration;
  }, [exaggeration, terrainReady]);


  return <div ref={mount} className="terrain-canvas" aria-label="ドラッグして回転、ホイールやピンチで拡大縮小する日本列島の3D地形" role="img" />;
}
