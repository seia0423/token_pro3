# 灯剣 試合シミュレーター

生成したチームJSON同士を、灯剣ルールの試合エンジンで対戦させる別プロジェクトです。

## 使い方

普段は次のファイルをダブルクリックします。

- `C:\Users\Owner\OneDrive\ドキュメント\灯剣選手生成\灯剣バトルを開く.cmd`
- または `C:\Users\Owner\OneDrive\ドキュメント\灯剣選手生成\touken-battle-sim\灯剣バトルを開く.cmd`

起動するとブラウザで操作画面が開きます。

画面では次を操作できます。

- Home / Away のチームJSON読み込み
- フォーメーション選択
- 戦術選択
- seed指定
- 1試合の実行
- 連戦による勝率確認
- ゴール、射出、奪取、迎撃、遮断、パスのログ確認
- 編成結果の確認

## 入力JSON

チーム生成側から保存したJSONをそのまま読み込めます。

配列形式:

```json
[
  {
    "fullName": "Player Name",
    "rating": 78,
    "bestPosition": "7",
    "positionRatings": { "7": 88, "17": 74 },
    "stats": { "シュート": 82, "チームワーク": 71 }
  }
]
```

チーム名つき形式:

```json
{
  "name": "East Blades",
  "players": []
}
```

## 試合ルール

- 20分 x 3セクション、合計60分
- ルミナス保持、パス、奪取、迎撃、遮断、射出、ゴールをイベントとして解決
- `positionRatings` と `stats` から編成、保持、射出、奪取、迎撃、決定力、スタミナを評価
- #8 / #9 系のチェンジャーは状況に応じて自動投入
- seedを固定すると同じ結果を再現

## 開発用

```powershell
npm.cmd test
npm.cmd run sample
npm.cmd run web
```
