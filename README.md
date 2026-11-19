
# JAPAN GEOMETRY

国土地理院が公開する標高タイルを取得し、日本列島とその周辺の地形を Three.js で立体表示するブラウザアプリです。地形をドラッグして視点を変え、標高の強調倍率、背景地図、注目エリアを切り替えられます。

## 主な機能

- **3D標高地形**：国土地理院の DEMGM PNG 標高タイル（zoom 7）を、ブラウザ上で実際のメートル単位の標高に復元し、320×320分割のメッシュに変換します。架空の地形は生成しません。
- **地図表示**：「標高カラー」「地理院標準地図」「OpenStreetMap」から選択。地形の起伏はすべて同じ標高データを使用します。
- **視点操作**：マウスドラッグ・タッチで回転／移動、ホイール・ピンチで拡大縮小。
- **標高の強調**：縦方向を 1〜25 倍に調整。取得した標高値は変更しません。
- **エリア切替**：日本全域／本州／富士山周辺／北海道／九州／沖縄。
- **地点情報**：地形をクリック・タップすると緯度経度と地理院タイル由来の標高を表示。
- **読み込み状態**：標高タイル取得進捗、欠損枚数、取得エラーを表示。データがない場所を架空の高さで埋めません。
- **レスポンシブ**：PC・スマートフォンに対応。

**データ精度の注意**：日本全国の概観を表示するため、全球版 DEMGM（zoom 7、144タイル）を使用しています。地形は320×320分割で表示し、ベースの地図画像はzoom 6、2048pxのテクスチャに合成します。初期バージョン（DEM zoom 6／208×208分割）よりXY解像度が向上していますが、取得枚数・メモリ消費は増加します。山頂・谷などの詳細地形を再現する高精細 DEM5/DEM10 ではありません。標高タイルはピクセル単位の離散値であり、表示される最高点が実際の山頂標高と一致するとは限りません。また、対象領域は日本の周辺を含む矩形で、国境や海岸線で切り抜いていません。

## 公開先

| 環境 | ブランチ | URL |
| --- | --- | --- |
| 本番 | main | https://naoiw.github.io/japan-geometry/ |
| 開発プレビュー | develop | https://naoiw.github.io/japan-geometry/develop/ |

2つのブランチのビルドを同じ GitHub Pages サイトへ公開します。Pages の Source は **GitHub Actions** に設定してください。配信が始まるまでは上記URLが404になる場合があります。

## 技術スタック

- React 19 / TypeScript / Vite 7：ブラウザUI・状態管理・ビルド
- Three.js / OrbitControls：WebGLによる地形メッシュ・視点操作
- 国土地理院 DEMGM PNG タイル：地形の標高データ
- 国土地理院 標準地図、OpenStreetMap raster tiles：切替可能な地図テクスチャ
- Node.js 26 / Node 組み込みテスト：計算・仕様のテスト
- GitHub Actions / GitHub Pages：CI・2環境の静的配信

## ローカル開発

```bash
git clone https://github.com/naoiw/japan-geometry.git
cd japan-geometry
git switch develop
npm install
npm run dev
npm test
npm run build
```

本番／プレビュー用ビルドはそれぞれ `npm run build:pages:main` と `npm run build:pages:develop` です。

## ブランチ運用

通常の開発・修正は develop、公開済みの安定版は main。develop の push と PR でテスト・ビルドを検証し、develop → main の PR で本番へ反映します。main にマージした後も develop は維持します。

## ディレクトリ構成

- `src/App.tsx`：画面・レイヤー・標高倍率・表示エリア・地点情報
- `src/components/TerrainScene.tsx`：Three.js描画とジオメトリ生成、カメラ操作、クリックによる標高取得
- `src/lib/terrain.ts`：タイル座標変換・標高PNGデコード・地理座標と模型座標の変換
- `src/lib/tiles.ts`：GSI標高タイルと地図画像の読み込み・描画
- `src/styles.css`：ISS TRACKER / WORLD WEATHER と共通思想のダーク系レスポンシブUI
- `tests/terrain.test.ts`：タイル・座標・標高値の単体テスト
- `.github/workflows/`：CI、main＋developのGitHub Pagesデプロイ
- `docs/`：仕様、開発、公開構成、UI方針

## ドキュメント

- [仕様](docs/SPEC.md)
- [開発・検証](docs/DEVELOPMENT.md)
- [GitHub Pages公開](docs/DEPLOYMENT.md)
- [UI方針](docs/UI.md)

## データ出典と利用条件

- 標高タイル／地理院標準地図：**[国土地理院・地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)**（[コンテンツ利用規約](https://maps.gsi.go.jp/help/termsofuse.html)）
- OpenStreetMap 地図画像：**© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)**。タイルサービス利用時は[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)に従ってください。
- 描画ライブラリ：[Three.js](https://threejs.org/)

GSI・OSMタイルは表示時に提供元からブラウザへ取得します。OSM の標準タイルは地図レイヤー選択時だけ取得し、一括ダウンロード・オフラインキャッシュは行いません。自作コードは[MIT License](LICENSE)。外部データや地図画像には各提供元の利用条件が別途適用されます。
