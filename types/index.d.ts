export type FireworkStyle = 'peony' | 'chrysanthemum' | 'willow' | 'ring'

export type Firework = {
  id: number
  seed: number
  style: FireworkStyle
  x: number
  y: number
  radius: number
  color: string
  accent: string
  age: number
  life: number
}

declare module 'claude-code' {
  interface PluginState {
    'commit-fireworks': { list: readonly Firework[] }
  }
}
