# commit-fireworks

Claude 每新增一個 commit，就在提示列上方放一發文字煙火的 Claude Code mod。

![12 發煙火](docs/fireworks.gif)

上圖是 12 發煙火同時出現的樣子，由同一份繪製程式輸出

## 特色

- 一次指令新增幾個 commit 就放幾發，每發間隔 250ms 依序升空；後續步驟（例如 `git push`）失敗也照放
- 每發煙火的位置、大小、雙色配色、樣式都隨機，樣式有牡丹、菊花、垂柳、雙環 4 種
- 小顆約 3 秒，大顆最長約 8 秒
- 所有煙火共用一個每 80ms 重繪的動畫迴圈，同時最多 12 發；全部消失後迴圈停止，畫面還原
- 全螢幕模式下，畫面區塊會用到可用的最大高度
- 完全在本機執行，不呼叫模型，不花 token

## 安裝

在 Claude Code 的提示列輸入：

```
/plugin install commit-fireworks --marketplace AdaaWu/commit-fireworks
```

或在終端機執行：

```
claude plugin install commit-fireworks --marketplace AdaaWu/commit-fireworks
```

先回 `y` 加入市集，再選安裝範圍。選 user scope 的話，之後每個 session 都會自動載入。

## 驗證

在任一個 git repo 叫 Claude 執行 `git commit --allow-empty -m test`，提示列上方就會出現煙火。

---

# commit-fireworks (English)

A Claude Code mod that launches one text firework above the prompt for every new commit Claude makes.

## Features

- One command that makes several commits launches one firework per commit, 250 ms apart, even when a later step such as `git push` fails
- Each firework has a random position, size, color pair and style (peony, chrysanthemum, willow, ring)
- Small fireworks last about 3 seconds, large ones up to 8 seconds
- All fireworks share one 80 ms animation loop, at most 12 at a time; the loop stops and the screen is restored once the last one fades
- In fullscreen mode the band uses the maximum available height
- Runs entirely on your machine, never calls the model, costs no tokens

The GIF above shows 12 fireworks at once. It is rendered by the same drawing code, not a terminal recording.

## Install

At the prompt of a terminal session:

```
/plugin install commit-fireworks --marketplace AdaaWu/commit-fireworks
```

From a shell:

```
claude plugin install commit-fireworks --marketplace AdaaWu/commit-fireworks
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

## Verify

In any git repo, ask Claude to run `git commit --allow-empty -m test`. Fireworks appear above the prompt.
