
# GitHub Pages 公開構成

## URL

| 用途 | ブランチ | URL |
| --- | --- | --- |
| 本番 | main | https://naoiw.github.io/japan-geometry/ |
| プレビュー | develop | https://naoiw.github.io/japan-geometry/develop/ |

GitHub Pages は1リポジトリにつき1サイトなので、両ブランチを同一のPagesアーティファクト内に合成します。**Settings → Pages → Build and deployment → Source を GitHub Actions に設定**してください。Pages未有効時、Actionsデプロイが成功するまでURLは404です。

## Actions

- `.github/workflows/validate-develop.yml`：develop push／main・develop向けPRのテストとビルド。
- `.github/workflows/deploy-pages.yml`：mainへのpush、またはdevelopのpush検証成功時に起動。
- production は main のソース、preview は develop（workflow_run時には検証対象のSHA）を別々にcheckout。
- mainは `base=/japan-geometry/`、developは `base=/japan-geometry/develop/` を指定してViteビルド。
- mainのdistを公開ルートに、developのdistを公開ルート内のdevelopサブディレクトリに合成してActionsでデプロイ。
- デプロイは既存リポジトリと同じくmainを起点とするワークフローで実行し、github-pages環境のブランチ制限を回避。

## 初期設定と確認

1. Settings → Pages で Source = GitHub Actions に変更。
2. Actions権限と `github-pages` Environmentの設定を確認。
3. Actions の Deploy to GitHub Pages が成功したことを確認。
4. 本番 URL、続いてプレビュー URLを開き、両方でタイルとJS/CSSを読み込めるか確認。
5. developのみ変更した後、プレビュー側にその更新が反映され、本番は従前の状態であることを確認。

本リポジトリはサーバー・Secrets・環境変数を不要とする静的サイトです。

## トラブルシュート

- 404：Pages未有効、SourceがDeploy from branchのまま、またはActionsデプロイ失敗。
- JS/CSSの404：Vite baseとGitHub Pagesのパスを確認。
- WebGLエラー：端末のGPU対応、ブラウザのハードウェアアクセラレーションを確認。
- 標高が見えない：地理院タイルへの到達性、CORS、ネットワーク制限を確認。
- 地図レイヤーが見えない：地図配信元の通信・レート制限・CORS・利用規約を確認。
