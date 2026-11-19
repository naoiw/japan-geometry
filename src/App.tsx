
import { useCallback, useState } from 'react';
import TerrainScene, { type PickedPoint, type ViewMode } from './components/TerrainScene';
import { DEM_ZOOM, tileRange, JAPAN_BOUNDS } from './lib/terrain';

const TILE_COUNT = tileRange(JAPAN_BOUNDS, DEM_ZOOM).length;
const coordinate = (value: number, positive: string, negative: string) =>
  Math.abs(value).toFixed(4) + '° ' + (value >= 0 ? positive : negative);

export default function App() {
  const [exaggeration, setExaggeration] = useState(1);
  const [viewRequest, setViewRequest] = useState<{ mode: ViewMode } | null>(null);
  const [progress, setProgress] = useState(0);
  const [terrainFailed, setTerrainFailed] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const handleProgress = useCallback((loaded: number) => setProgress(loaded), []);
  const handleReady = useCallback((failed: number) => {
    setTerrainFailed(failed);
    setReady(true);
    setError(null);
  }, []);
  const handleError = useCallback((message: string) => setError(message), []);
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
            viewRequest={viewRequest}
            onProgress={handleProgress}
            onReady={handleReady}
            onError={handleError}
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
            <p>実際の標高タイルから生成した地形を、自由な角度で探索できます。</p>
          </div>
          <section className="panel-section">
            <div className="section-head"><h2>視点操作</h2><span>01 / CAMERA</span></div>
            <div className="view-buttons">
              <button type="button" onClick={() => setViewRequest({ mode: 'reset' })} disabled={!ready}>視点をリセット</button>
              <button type="button" onClick={() => setViewRequest({ mode: 'top' })} disabled={!ready}>上面視</button>
            </div>
          </section>
          <section className="panel-section">
            <div className="section-head"><h2>標高の強調</h2><span>02 / EXAGGERATION</span></div>
            <div className="slider-value"><strong>{exaggeration}<small>×</small></strong><span>高さを見やすく強調</span></div>
            <input aria-label="標高の強調倍率" type="range" min="0" max="10" step="1"
              value={exaggeration} onChange={e => setExaggeration(Number(e.currentTarget.value))} />
            <div className="range-labels"><span>0× (フラット)</span><span>10×</span></div>
            <p className="control-description">0×で起伏のない平面、1×で等倍表示です。クリック地点の実際の標高値は変化しません。</p>
          </section>
          <section className="panel-section point-panel">
            <div className="section-head"><h2>地点の標高</h2><span>03 / INSPECT</span></div>
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
        <span className="footer-copyright">© 2026 naoiw</span>
        <span className="footer-links">
          <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">標高データ：国土地理院 ↗</a>
          <span className="footer-separator" aria-hidden="true">·</span>
          <span>3D: THREE.JS</span>
          <span className="footer-separator" aria-hidden="true">·</span>
          <a href="https://github.com/naoiw/japan-geometry" target="_blank" rel="noopener noreferrer" aria-label="GitHubでソースコードを開く">GitHub ↗</a>
        </span>
      </footer>
    </div>
  );
}
