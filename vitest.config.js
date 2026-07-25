import { defineConfig } from 'vitest/config';

/* Dev-only test config (the shipped app still has no build step and no config).
   The default `threads` pool intermittently fails worker init on this setup —
   a "Cannot read properties of undefined (reading 'config')" race at collection —
   and parallel file workers make it more likely. `forks` + serial files run the
   small suite deterministically everywhere (~1.5s), so `npm test` and CI can't
   flake on the pool rather than on a real failure. */
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
