import type { Firework, FireworkStyle } from '../types'

export const TICK_MS = 80
export const RISE_MS = 500
const FADE_LENGTH_MS = 900
const WHITE = '#ffffff'
// 射線方向對應的字元：水平、右下、垂直、左下
const RAY_GLYPHS = ['-', '\\', '|', '/']
// 各樣式的下墜幅度、射線尾長、角度擾動
const PHYSICS: Record<FireworkStyle, { droop: number; tail: number; jitter: number }> = {
  peony: { droop: 1.2, tail: 0.45, jitter: 0.3 },
  chrysanthemum: { droop: 1.6, tail: 0.8, jitter: 0.2 },
  willow: { droop: 4.5, tail: 0, jitter: 0.4 },
  ring: { droop: 0.8, tail: 0, jitter: 0 },
}

export type Cell = { ch: string; color: string }
export type Segment = { text: string; color: string | undefined }
type Grid = (Cell | undefined)[][]

// 依比例調暗 hex 顏色
const shade = (color: string, k: number): string => {
  const channel = (i: number) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * Math.min(1, k)).toString(16).padStart(2, '0')

  return `#${channel(1)}${channel(3)}${channel(5)}`
}

// 以種子產生可重現的亂數序列
const seeded = (seed: number) => {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 三個整數雜湊成 0～1，供閃爍使用
const hash = (a: number, b: number, c: number): number =>
  ((((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0) % 1000) / 1000

const rayGlyph = (angle: number): string => {
  const a = ((angle % Math.PI) + Math.PI) % Math.PI

  return RAY_GLYPHS[Math.round(a / (Math.PI / 4)) % 4] ?? '*'
}

const plot = (grid: Grid, x: number, y: number, cell: Cell): void => {
  const row = grid[Math.round(y)]
  const col = Math.round(x)

  if (row !== undefined && col >= 0 && col < row.length) {
    row[col] = cell
  }
}

// 上升階段：白色彈頭、尾焰與零星火花
const drawRocket = (grid: Grid, shot: Firework, cx: number, cy: number): void => {
  const p = shot.age / RISE_MS
  const eased = 1 - (1 - p) * (1 - p)
  const bottom = grid.length - 1
  const headY = bottom - (bottom - cy) * eased
  const hx = cx + Math.sin(shot.age / 60 + shot.seed) * 0.4
  const frame = Math.floor(shot.age / TICK_MS)

  plot(grid, hx, headY + 2, { ch: '.', color: shade(shot.color, 0.4) })
  plot(grid, hx, headY + 1, { ch: '|', color: shade(shot.color, 0.75) })

  if (hash(shot.id, frame, 1) > 0.4) {
    const side = hash(shot.id, frame, 2) > 0.5 ? 1 : -1
    plot(grid, hx + side, headY + 1 + hash(shot.id, frame, 3) * 2, { ch: "'", color: shade(shot.accent, 0.7) })
  }
  plot(grid, hx, headY, { ch: '^', color: WHITE })
}

// 炸開階段：放射狀射線向外減速擴散、下墜，結束前閃爍熄滅
const drawBurst = (grid: Grid, shot: Firework, cx: number, cy: number): void => {
  const t = shot.age - RISE_MS
  const fadeStart = shot.life - RISE_MS - FADE_LENGTH_MS
  const fade = t < fadeStart ? 0 : Math.min(1, (t - fadeStart) / FADE_LENGTH_MS)
  const brightness = 1 - fade * 0.55
  const physics = PHYSICS[shot.style]
  const frame = Math.floor(shot.age / TICK_MS)
  const random = seeded(shot.seed)
  const count = 4 + shot.radius * 4
  const reach = 2 + shot.radius * 1.3
  const droop = (time: number) => physics.droop * (1 - Math.exp(-((time / 1000) ** 2) / 3))
  const point = (angle: number, r: number, time: number): [number, number] => [
    cx + Math.cos(angle) * r * 2,
    cy + Math.sin(angle) * r + droop(time),
  ]
  const spread = (time: number) => 1 - Math.exp(-time / 300)

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI + (random() - 0.5) * physics.jitter * ((2 * Math.PI) / count)
    const speedRoll = random()
    const isInner = shot.style === 'ring' && i % 2 === 1
    const speed = reach * (shot.style === 'ring' ? (isInner ? 0.55 : 1) : 0.85 + speedRoll * 0.15)
    const base = i % 2 === 0 ? shot.color : shot.accent
    const twinkle = hash(shot.id, i, frame)

    if (fade > 0 && twinkle < fade * 0.85) {
      continue
    }

    const headR = speed * spread(t)

    if (physics.tail > 0 && fade === 0) {
      const tailLen = headR * physics.tail * (0.4 + 0.6 * Math.exp(-t / 1500))

      for (let s = headR - tailLen; s < headR - 0.4; s += 0.5) {
        const [x, y] = point(angle, s, t)
        plot(grid, x, y, { ch: rayGlyph(angle), color: shade(base, 0.35 + 0.55 * (s / headR)) })
      }
    }

    if (shot.style === 'willow') {
      for (let k = 4; k >= 1; k--) {
        const past = Math.max(0, t - k * 160)
        const [x, y] = point(angle, speed * spread(past), past)
        plot(grid, x, y, { ch: k > 2 ? '.' : ':', color: shade(base, (0.6 * brightness) / k + 0.15) })
      }
    }

    const [px, py] = point(angle, headR, t)
    const isSparkle = fade === 0 && t > 400 && twinkle > 0.88
    const head = shot.style === 'ring' ? 'o' : '*'
    const ch = fade > 0.5 ? '.' : fade > 0 ? '+' : head
    plot(grid, px, py, { ch, color: isSparkle ? WHITE : shade(base, brightness) })
  }

  if (t < 200) {
    plot(grid, cx - 2, cy, { ch: '-', color: WHITE })
    plot(grid, cx + 2, cy, { ch: '-', color: WHITE })
    plot(grid, cx, cy - 1, { ch: '|', color: WHITE })
    plot(grid, cx, cy + 1, { ch: '|', color: WHITE })
    plot(grid, cx, cy, { ch: '@', color: WHITE })
  }
}

// 把所有煙火合成到同一張畫布
export const renderGrid = (shots: readonly Firework[], rows: number, cols: number): Grid => {
  const grid: Grid = Array.from({ length: rows }, () => Array<Cell | undefined>(cols).fill(undefined))

  for (const shot of shots) {
    const cx = shot.x * (cols - 1)
    const cy = shot.y * (rows - 1)

    if (shot.age < RISE_MS) {
      drawRocket(grid, shot, cx, cy)
    } else {
      drawBurst(grid, shot, cx, cy)
    }
  }

  return grid
}

// 把一列格子合併成同色片段
export const segments = (row: readonly (Cell | undefined)[]): Segment[] => {
  const out: Segment[] = []

  for (const cell of row) {
    const color = cell?.color
    const last = out[out.length - 1]

    if (last !== undefined && last.color === color) {
      last.text += cell?.ch ?? ' '
    } else {
      out.push({ text: cell?.ch ?? ' ', color })
    }
  }

  return out
}
