import { defineConfig } from 'vitest/config'

// Single source of truth for test config -- vite.config.ts intentionally
// has no `test` block. When both exist, Vitest resolves settings from
// this file and silently ignores vite.config.ts's `test` block, so a
// duplicate there would just be dead, misleading config. If test
// settings need to change, change them here only.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    // threads: true, // default; set to false to run all tests in single thread if needed
  },
})
