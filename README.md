## ドルフロ2ガチャ履歴表示

https://df2gh.github.io/gacha/

非公式のドルフロ2ガチャ履歴を表示するサイト。
PC 用のクライアント環境でのみ動作します。スマートフォン向けのアプリではアクセストークンを取得できないため動作しません。

日本サーバーのみ対応。

オープンAPIからユーザーのガチャ履歴を取得して表示します。
公式では6ヶ月で消えてしまう(らしい)履歴データを保存しながら表示できます。

### 使い方
※以下を行う前にゲームを起動してミステリーボックスの履歴を開いておいてください。

ミステリーボックスの履歴を読み出すにはプレイヤーデータが必要です。

プレイヤーデータは https://exilium.moe/ja/import で使われているものと同じです。moe サイトで公開されているトークン抜き出しスクリプトで取得できます。

入手したプレイヤーデータをサイトの「プレイヤーデータから読み込み」へ貼り付けてください。

「読み込みボタン」を押すと履歴を読み込んで表示します。

プレイヤーデータはブラウザのローカルストレージに保存して再利用されるため毎回入力する必要はありません。
プレイヤーデータ中のアクセストークンが無効になると読み込めなくなります。ページの右上にある「設定」ボタンからプレイヤーデータを更新してください。

Linux 環境でプレイしている方は `tools/udata.py` にあるスクリプトでプレイヤーデータを抽出できます。
ダウンロードしたファイルを開いて `path` を環境に合わせて修正してお使いください。

### 不明ID報告
ガチャ履歴のデータにはガチャで得た人形か武器のID、訪問回のIDおよび日付のみ含まれています。

IDとアイテム名の紐付けを行う必要がありますが、すべて引くのは難しいので
表示は利用者からの報告に頼っています。

不明報告リンクが表示された場合、先のフォームでアイテム名を選択して送信できます。

### 開発
人形 ID は公式サイトの人形リストにある画像ファイル名に含まれている数値と一致します。

人形のアイコンは画像の上部351ピクセル分を切り出して60各サイズに縮小したものです。
ImageMagick なら以下のように処理します。
```
convert $1 -crop 351x351+0+0 -resize 60x60 $2
```

