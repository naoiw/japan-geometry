
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  JAPAN_BOUNDS, DEM_ZOOM, MAP_ZOOM, HEIGHT_UNITS_PER_METRE, getElevation,
  lonLatToNormalized, normalizedToLonLat, pointOnTerrain, terrainSize, type HeightTiles,
} from '../lib/terrain';
import { loadHeightTiles, loadMapCanvas, type MapLayer } from '../lib/tiles';

export type Region = 'all' | 'honshu' | 'fuji' | 'hokkaido' | 'kyushu' | 'okinawa';
export type PickedPoint = { longitude: number; latitude: number; elevation: number };

type Props = {
  exaggeration: number;
  layer: MapLayer;
  region: Region;
  onProgress: (loaded: number, total: number) => void;
  onReady: (failed: number) => void;
  onError: (message: string) => void;
  onNotice: (message: string | null) => void;
  onPick: (point: PickedPoint) => void;
};

const COLUMN_COUNT = 208;
const ROW_COUNT = 208;

function colorForElevation(elevation: number | null): THREE.Color {
  if (elevation === null) return new THREE.Color('#203241');
  if (elevation <= 0) return new THREE.Color('#16465a');
  const stops: [number, string][] = [
    [0, '#3b8c76'], [200, '#72a37a'], [550, '#a0a47d'],
    [1100, '#c0a078'], [1900, '#a48677'], [2800, '#d3c5ac'], [3900, '#f1ede0'],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (elevation <= stops[i][0]) {
      const t = (elevation - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return new THREE.Color(stops[i - 1][1]).lerp(new THREE.Color(stops[i][1]), t);
    }
  }
  return new THREE.Color('#f1ede0');
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

const REGIONS: Record<Region, { lon: number; lat: number; distance: number }> = {
  all: { lon: 138, lat: 35, distance: 37 },
  honshu: { lon: 138.0, lat: 36.2, distance: 18 },
  fuji: { lon: 138.7274, lat: 35.3606, distance: 8 },
  hokkaido: { lon: 142.8, lat: 43.2, distance: 14 },
  kyushu: { lon: 131.1, lat: 32.4, distance: 13 },
  okinawa: { lon: 127.8, lat: 26.3, distance: 12 },
};

export default function TerrainScene({
  exaggeration, layer, region, onProgress, onReady, onError, onNotice, onPick,
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
  const mapMaterials = useRef<Partial<Record<'osm' | 'gsi', THREE.MeshStandardMaterial>>>({});
  const [terrainReady, setTerrainReady] = useState(false);
  const latestHandlers = useRef({ onProgress, onReady, onError, onNotice, onPick });
  latestHandlers.current = { onProgress, onReady, onError, onNotice, onPick };

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
      Object.values(mapMaterials.current).forEach((material) => { material?.map?.dispose(); material?.dispose(); });
      mapMaterials.current = {};
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

  useEffect(() => {
    const state = canvasState.current;
    if (!state) return;
    const view = REGIONS[region];
    const selected = pointOnTerrain(view.lon, view.lat);
    state.controls.target.set(selected.x, 0, selected.z);
    state.camera.position.set(
      selected.x + view.distance * 0.17,
      view.distance * 0.6,
      selected.z + view.distance * 0.8,
    );
    state.controls.update();
  }, [region, terrainReady]);

  useEffect(() => {
    const mesh = canvasState.current?.mesh;
    const state = canvasState.current;
    if (!mesh || !state) return;
    if (layer === 'elevation') {
      mesh.material = state.elevationMaterial;
      onNotice(null);
      return;
    }
    let cancelled = false;
    const existing = mapMaterials.current[layer];
    if (existing) {
      mesh.material = existing;
      onNotice(null);
      return;
    }
    onNotice('地図画像を読み込んでいます…');
    void loadMapCanvas(layer, MAP_ZOOM, JAPAN_BOUNDS).then(({ canvas, missing }) => {
      if (cancelled) return;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, state.renderer.capabilities.getMaxAnisotropy());
      const material = new THREE.MeshStandardMaterial({
        map: texture, side: THREE.DoubleSide, roughness: 0.98, metalness: 0,
      });
      mapMaterials.current[layer] = material;
      mesh.material = material;
      onNotice(missing ? '地図画像の一部が取得できませんでした（' + missing + '枚）' : null);
    }).catch((error: unknown) => {
      if (!cancelled) onNotice(error instanceof Error ? error.message : '地図画像を取得できません');
    });
    return () => { cancelled = true; };
  }, [layer, terrainReady, onNotice]);

  return <div ref={mount} className="terrain-canvas" aria-label="ドラッグして回転、ホイールやピンチで拡大縮小する日本列島の3D地形" role="img" />;
}
