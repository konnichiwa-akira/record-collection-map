# Record Collection Map

個人のレコードコレクションを、**横軸 = 初版発売年 / 縦軸 = ジャンル**で可視化する静的Webアプリです。

## 主な機能

- コレクションの時系列 × ジャンル表示
- アルバムアートワーク表示
- 年代・検索フィルター
- 影響ネットワーク表示
- 選択中アルバムの詳細パネル表示 / 非表示（非表示時は可視化領域を拡張）
- 線の色 = 情報ソースの確からしさ
- 線の太さ = 影響関係の強さ
- MusicBrainz / Cover Art Archiveを利用した初版年・アートワーク補完
- 影響関係の根拠ソース表示

## 公開データについて

公開版には、元のDiscogs CSV、購入日、登録日、コンディション、メモ等の個人管理情報は含めていません。
表示に必要な加工済みコレクション情報のみ収録しています。

## GitHub Pages

このリポジトリは静的サイトとしてGitHub Pagesで公開できます。

Settings → Pages → Build and deployment → Source で **Deploy from a branch** を選び、
`main` / `/(root)` を指定してください。

## Sources

影響関係の出典については [SOURCES.md](./SOURCES.md) を参照してください。
