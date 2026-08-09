import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    pool: 'threads',
    // threads: true, // default; set to false to run all tests in single thread if needed
  },
})
