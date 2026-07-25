import { defineConfig } from 'vitest/config';

/* Dev-only test config (the shipped app still has no build step and no config).
   The default `threads` pool intermittently fails worker init on this setup —
   a "Cannot read properties of undefined (reading 'config')" race at collection —
   and parallel file workers make it more likely. `forks` + serial files run the
   small suite deterministically everywhere (~1.5s), so `npm test` and CI can't
   flake on the pool rather than on a real failure.

   Vitest 4 REMOVED `poolOptions`, which is where that serialization used to live
   (`poolOptions: { forks: { singleFork: true } }`). It didn't error — it printed
   a deprecation line and silently ignored the option, so the collection race came
   straight back. `fileParallelism: false` is the replacement and forces workers to
   1; `singleFork` no longer exists anywhere in the package. `pool` is now 'forks'
   by default too, but it stays spelled out because the choice is deliberate. */
export default defineConfig({
  test: {
    pool: 'forks',
    fileParallelism: false,
  },
});
