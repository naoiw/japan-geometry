
import { useCallback, useState } from 'react';
import TerrainScene, { type PickedPoint, type Region } from './components/TerrainScene';
import { DEM_ZOOM, tileRange, JAPAN_BOUNDS } from './lib/terrain';
import type { MapLayer } from './lib/tiles';

const TILE_COUNT = tileRange(JAPAN_BOUNDS, DEM_ZOOM).length;
const REGIONS: { id: Region; label: string }[] = [
  { id: 'all', label: '日本全域' },
  { id: 'honshu', label: '本州' },
  { id: 'fuji', label: '富士山周辺' },
  { id: 'hokkaido', label: '北海道' },
  { id: 'kyushu', label: '九州' },
  { id: 'okinawa', label: '沖縄' },
];
const LAYERS: { id: MapLayer; label: string; desc: string }[] = [
  { id: 'elevation', label: '標高カラー', desc: '高さを色分け' },
  { id: 'gsi', label: '地理院地図', desc: '地名・道路など' },
  { id: 'osm', label: 'OpenStreetMap', desc: 'OSMの地図画像' },
];
const coordinate = (value: number, positive: string, negative: string) =>
  Math.abs(value).toFixed(4) + '° ' + (value >= 0 ? positive : negative);

export default function App() {
  const [layer, setLayer] = useState<MapLayer>('elevation');
  const [exaggeration, setExaggeration] = useState(12);
  const [region, setRegion] = useState<Region>('all');
  const [progress, setProgress] = useState(0);
  const [terrainFailed, setTerrainFailed] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const handleProgress = useCallback((loaded: number) => setProgress(loaded), []);
  const handleReady = useCallback((failed: number) => {
    setTerrainFailed(failed);
    setReady(true);
    setError(null);
  }, []);
  const handleError = useCallback((message: string) => setError(message), []);
  const handleNotice = useCallback((message: string | null) => setNotice(message), []);
  const handlePick = useCallback((point: PickedPoint) => setPicked(point), []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon" aria-hidden="true">△</span><span>JAPAN <strong>GEOMETRY</strong></span></div>
        <div className="topbar-right">
          <span className="topbar-caption">GEOSPATIAL TERRAIN EXPLORER</span>
          <span className="status-pill"><span className={'status-dot ' + (ready ? 'online' : 'pending')} />{ready ? 'GSI DEM LOADED' : 'LOADING TERRAIN'}</span>
        </div>
      </header>

      <main className="main-stage">
        <section className="terrain-stage" aria-label="日本列島の3D地形ビューア">
          <div className="stage-glow" aria-hidden="true" />
          <TerrainScene
            exaggeration={exaggeration}
            layer={layer}
            region={region}
            onProgress={handleProgress}
            onReady={handleReady}
            onError={handleError}
            onNotice={handleNotice}
            onPick={handlePick}
          />
          <div className="scene-label" aria-hidden="true">
            <span className="scene-label-strong">JAPAN · TOPOGRAPHY</span>
            <span>20°–47° N / 122°–154° E</span>
          </div>
          <div className="compass" aria-hidden="true"><span>N</span><span>◆</span></div>
          {!ready && !error && (
            <div className="loading-overlay" role="status">
              <div className="loading-spinner" />
              <strong>標高データを読み込み中</strong>
              <span>国土地理院 DEMGM · {progress}/{TILE_COUNT} タイル</span>
              <div className="progress-track"><div style={{ width: Math.round(progress / TILE_COUNT * 100) + '%' }} /></div>
            </div>
          )}
          {error && <div className="scene-error" role="alert"><strong>地形を表示できません</strong><span>{error}</span><button type="button" onClick={() => window.location.reload()}>再読み込み</button></div>}
          <div className="scene-hint">ドラッグ：回転・移動　ホイール / ピンチ：拡大縮小　クリック：標高を確認</div>
        </section>

        <aside className="control-panel" aria-label="地形表示の設定">
          <div className="panel-intro">
            <span className="eyebrow">JAPAN / ELEVATION MODEL</span>
            <h1>日本列島の地形を、<br /><em>立体で見る。</em></h1>
            <p>実際の標高タイルから生成した地形を、自由な角度で探索できます。</p>
          </div>
          <section className="panel-section">
            <div className="section-head"><h2>表示レイヤー</h2><span>01 / MAP LAYER</span></div>
            <div className="layer-list">
              {LAYERS.map(option => (
                <button
                  type="button"
                  key={option.id}
                  className={'layer-option ' + (layer === option.id ? 'selected' : '')}
                  aria-pressed={layer === option.id}
                  onClick={() => setLayer(option.id)}
                  disabled={!ready}
                >
                  <span className="radio-circle" />
                  <span><strong>{option.label}</strong><small>{option.desc}</small></span>
                </button>
              ))}
            </div>
            {notice && <p className="notice" role="status">{notice}</p>}
          </section>
          <section className="panel-section">
            <div className="section-head"><h2>標高の強調</h2><span>02 / EXAGGERATION</span></div>
            <div className="slider-value"><strong>{exaggeration}<small>×</small></strong><span>高さを見やすく強調</span></div>
            <input aria-label="標高の強調倍率" type="range" min="1" max="25" step="1"
              value={exaggeration} onChange={e => setExaggeration(Number(e.currentTarget.value))} />
            <div className="range-labels"><span>1×</span><span>25×</span></div>
            <p className="control-description">平面距離に対する高さの表示倍率です。取得した標高の値そのものは変化しません。</p>
          </section>
          <section className="panel-section">
            <div className="section-head"><h2>エリア移動</h2><span>03 / LOCATION</span></div>
            <div className="region-grid">
              {REGIONS.map(option => (
                <button key={option.id} type="button" onClick={() => setRegion(option.id)}
                  className={'region-button ' + (region === option.id ? 'selected' : '')}
                  aria-pressed={region === option.id}>{option.label}</button>
              ))}
            </div>
          </section>
          <section className="panel-section point-panel">
            <div className="section-head"><h2>地点の標高</h2><span>04 / INSPECT</span></div>
            {picked ? (
              <div className="picked-info">
                <div className="picked-height"><strong>{picked.elevation.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}</strong><span>m</span></div>
                <div className="coordinates">
                  <span>{coordinate(picked.latitude, 'N', 'S')}</span>
                  <span>{coordinate(picked.longitude, 'E', 'W')}</span>
                </div>
              </div>
            ) : (
              <p className="empty-point">地形上の地点をクリック・タップすると、その地点の標高と緯度経度が表示されます。</p>
            )}
          </section>
          <div className="panel-note">
            <span>DATA STATUS</span>
            <p>{ready ? '標高タイル ' + (TILE_COUNT - terrainFailed) + '/' + TILE_COUNT + ' 枚取得' : error ? '取得に失敗しました' : '標高データ取得中'}</p>
            <small>全国表示はDEMGM（全球版）による概観用の地形です。山頂などの標高は詳細測量値と一致しない場合があります。</small>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <span>JAPAN GEOMETRY</span>
        <span className="footer-credits">
          <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">標高・地図：国土地理院</a>
          <span>·</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
          <span>·</span><span>RENDERED WITH THREE.JS</span>
        </span>
      </footer>
    </div>
  );
}
