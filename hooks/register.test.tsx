import type { On, ToolCallResult } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { Firework } from '../types'

const BASE = ['a1', 'a2', 'a3']
// 足以讓每一發錯開發射完、又早於最短存活時間
const LAUNCH_WINDOW_MS = 2800

type Setup = { added: number; answer: ToolCallResult }

// 模擬 git：第一次回報指令前的 commit，之後回報多出 added 個
const arrange = (on: On, { added, answer }: Setup) => {
  const runs: string[][] = []
  const launched = new Set<number>()
  const after = [...BASE, ...Array.from({ length: added }, (_, i) => `n${i}`)]

  on('process.run', (_, e) => {
    runs.push([...e.argv])
    const shas = runs.length === 1 ? BASE : after

    return { value: { exitCode: 0, stdout: `${shas.join('\n')}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', () => answer)
  // 記下寫進狀態的每一發煙火
  on('state.set', (_, e, next) => {
    for (const shot of e.value as readonly Firework[]) {
      launched.add(shot.id)
    }

    return next(e)
  })

  return { runs, shots: () => launched.size }
}

const OK: ToolCallResult = { result: { stdout: '', stderr: '', interrupted: false } } as ToolCallResult
const FAILED: ToolCallResult = { result: { stdout: '', stderr: 'error', interrupted: false }, isError: true } as ToolCallResult

test('單一 commit 放 1 發', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 1, answer: OK })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(1)
})

test('一個呼叫 7 個 commit 放 7 發，且錯開發射', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 7, answer: OK })

  await $.tool.call({ tool: 'Bash', command: 'c(){ git commit -q -m "$1"; }\nc a\nc b' })
  await clock.settle()
  expect(seen.shots()).toBe(1)

  await clock.advance(LAUNCH_WINDOW_MS)
  expect(seen.shots()).toBe(7)
})

test('12 個 commit 放 12 發', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 12, answer: OK })

  await $.tool.call({ tool: 'Bash', command: 'for i in 1 2; do git commit -q -m $i; done' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(12)
})

test('13 個 commit 最多放 12 發', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 13, answer: OK })

  await $.tool.call({ tool: 'Bash', command: 'for i in 1 2; do git commit -q -m $i; done' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(12)
})

test('指令沒有 git commit 不放也不跑 git', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 0, answer: OK })

  await $.tool.call({ tool: 'Bash', command: 'git status' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(0)
  expect(seen.runs.length).toBe(0)
})

test('被擋下的指令不放', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 0, answer: { deny: 'no' } as ToolCallResult })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(0)
})

test('背景執行的指令不放', async ($, on) => {
  const clock = mock.clock(on)
  const answer = { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b1' } } as ToolCallResult
  const seen = arrange(on, { added: 1, answer })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(0)
})

test('commit 失敗沒有新 commit 不放', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 0, answer: FAILED })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(0)
})

test('指令成功但看不到新 commit 退回放 1 發', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 0, answer: OK })

  await $.tool.call({ tool: 'Bash', command: 'cd ../other && git commit -m x' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(1)
})

test('commit 成功但後面 push 失敗仍照新 commit 數放', async ($, on) => {
  const clock = mock.clock(on)
  const seen = arrange(on, { added: 3, answer: FAILED })

  await $.tool.call({ tool: 'Bash', command: 'git commit -m x && git push' })
  await clock.advance(LAUNCH_WINDOW_MS)

  expect(seen.shots()).toBe(3)
})
