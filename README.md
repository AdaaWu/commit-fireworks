# commit-fireworks

A Claude Code mod that launches text fireworks above the prompt every time Claude runs a successful `git commit`.

- Each firework has a random position, size, color pair and style (peony, chrysanthemum, willow, ring).
- Small fireworks last about 3 seconds, large ones up to 8 seconds.
- All fireworks share one 80 ms animation loop, at most 12 at a time; the loop stops and the screen is restored once the last one fades.

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
