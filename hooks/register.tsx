import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Firework, FireworkStyle } from '../types'

import { renderGrid, segments, TICK_MS } from './draw'

// 依半徑分段的存活時間範圍，小顆短大顆長
const LIFE_RANGE_MS: readonly [number, number][] = [[3000, 4500], [4500, 6500], [6500, 8000]]
const MAX_SHOTS = 12
// 同一次指令多發煙火之間的發射間隔
const LAUNCH_GAP_MS = 250
// 一般畫面的區塊高度；全螢幕時改用可用的最大高度
const BAND_ROWS = 14
const GIT_COMMIT = /(^|[;&|]\s*|\s)git(\s+-\S+(\s+\S+)?)*\s+commit\b/
const STYLES: readonly FireworkStyle[] = ['peony', 'chrysanthemum', 'willow', 'ring']
const list = atom({ plugin: 'commit-fireworks', key: 'list' } as const, [] as readonly Firework[])

// HSL 轉 hex
const hsl = (h: number, s: number, l: number): string => {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')

  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

// 列出所有分支可追到的 commit，讀不到時回傳 undefined
const commits = async ($: EngineInterface) => {
  const { exitCode, stdout } = await $.process.run(['git', 'rev-list', '--all'])

  return exitCode === 0 ? new Set(stdout.split('\n').filter(Boolean)) : undefined
}

// 在多個隨機候選中挑離現有煙火最遠的水平位置
const pickX = (shots: readonly Firework[]): number => {
  let best = 0.5
  let bestGap = -1

  for (let i = 0; i < 20; i++) {
    const x = 0.1 + Math.random() * 0.8
    const gap = Math.min(1, ...shots.map(s => Math.abs(s.x - x)))

    if (gap > bestGap) {
      best = x
      bestGap = gap
    }

    if (gap >= 0.15) {
      break
    }
  }

  return best
}

// 煙火計數與動畫迴圈，每次載入模組重新開始
type Show = { loop: Timer | undefined; nextId: number }

const stopLoop = (show: Show) => {
  show.loop?.cancel()
  show.loop = undefined
}

// 加入一發煙火，動畫迴圈沒在跑就啟動
async function launch($: EngineInterface, show: Show) {
  const size = Math.floor(Math.random() * LIFE_RANGE_MS.length)
  const [minLife, maxLife] = LIFE_RANGE_MS[size] ?? [3000, 8000]
  const hue = Math.random() * 360
  const shot: Firework = {
    id: show.nextId++,
    seed: Math.floor(Math.random() * 2 ** 31),
    style: STYLES[Math.floor(Math.random() * STYLES.length)] ?? 'peony',
    x: 0.5,
    y: 0.2 + Math.random() * 0.3,
    radius: size + 1,
    color: hsl(hue, 0.85 + Math.random() * 0.15, 0.6),
    accent: hsl((hue + 40 + Math.random() * 140) % 360, 0.9, 0.65),
    age: 0,
    life: minLife + Math.random() * (maxLife - minLife),
  }
  await update($, list, shots => [...shots, { ...shot, x: pickX(shots) }].slice(-MAX_SHOTS))

  if (show.loop === undefined) {
    show.loop = $.clock.every(TICK_MS, () => {
      void update($, list, shots => {
        const alive = shots
          .map(s => ({ ...s, age: s.age + TICK_MS }))
          .filter(s => s.age < s.life)

        if (alive.length === 0) {
          stopLoop(show)
        }

        return alive
      })
    })
  }
}

export const register: Register = on => {
  const show: Show = { loop: undefined, nextId: 0 }

  on('session.start', async ($, e, next) => {
    stopLoop(show)
    await update($, list, () => [])

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!GIT_COMMIT.test(e.command)) {
      return next(e)
    }

    const before = await commits($)
    const ran = await next(e)

    if (ran.deny !== undefined) {
      return ran
    }

    if (ran.isError !== true && (ran.result.backgroundTaskId !== undefined || ran.result.interrupted)) {
      return ran
    }

    const after = await commits($)
    const added = before === undefined || after === undefined ? 0 : [...after].filter(sha => !before.has(sha)).length
    // 看不到新 commit 但指令成功時，視為 commit 在別的 repo
    const count = Math.min(MAX_SHOTS, ran.isError === true ? added : Math.max(1, added))

    for (let i = 0; i < count; i++) {
      if (i === 0) {
        await launch($, show)
      } else {
        $.clock.after(i * LAUNCH_GAP_MS, () => void launch($, show))
      }
    }

    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shots = await read($, list)

    if (shots.length === 0 || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const rows = e.viewport?.isFullscreen === true ? e.props.maxRows : Math.min(BAND_ROWS, e.props.maxRows)
    const cols = e.props.bodyColumns
    const grid = renderGrid(shots, rows, cols)

    return (
      <Box flexDirection="column" height={rows} width={cols}>
        {grid.map((row, r) => (
          <Text key={`r${r}`}>
            {segments(row).map((seg, i) =>
              seg.color === undefined ? seg.text : (
                <Text key={`g${i}`} color={seg.color}>
                  {seg.text}
                </Text>
              ),
            )}
          </Text>
        ))}
      </Box>
    )
  })
}
