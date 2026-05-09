# プロンプト追加フロー

## 1. 素材を置く

`/Users/imanarimari/projects/content/gpt` に Markdown と画像を置く。

例:

```text
/Users/imanarimari/projects/content/gpt/
├── mothersday-card.md
└── mothersday-card.jpg
```

## 2. Markdownの先頭に公開設定を書く

```md
---
publish: true
id: mothersday-card
category: seasonal
badge: 母の日
title: 母の日メッセージカード編
subtitle: 画像を母の日カードに変換
image: mothersday-card.jpg
---

ここにコピーしたいプロンプト本文を書く。
```

使える `category`:

```text
seasonal     季節イベント
product      商品化
advertising  広告・ポスター
craft        クラフト・手作り
```

`badge` はカードに `季節イベント / 母の日` のように表示される補助ラベル。

## 3. 同期する

```bash
cd /Users/imanarimari/projects/dev/web/konmari-prompt
npm run sync:gpt
```

確認だけなら:

```bash
npm run sync:gpt:dry
```

同期で起きること:

- `publish: true` のMarkdownだけ読み込む
- 画像を `images/uploads/` にコピー
- `prompts.json` に追加・更新
- `/Users/imanarimari/projects/work/handout/konmari-prompt/` に公開用ファイルを同期

## 4. 公開する

```bash
cd /Users/imanarimari/projects/dev/web/konmari-prompt
git add index.html prompts.json images/uploads package.json scripts/sync-gpt-prompts.mjs PROMPT_FLOW.md
git commit -m "Add prompt sync flow"
git push origin main

cd /Users/imanarimari/projects/work/handout
git add konmari-prompt
git commit -m "Update KONMARI prompt site"
git push origin main
```

未公開メモや作業ファイルは、Markdownに `publish: true` を書かない限り取り込まれない。
