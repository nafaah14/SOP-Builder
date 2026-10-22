import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// YYYYMMDD-HHMM UTC — the version says what the code is, the build id says
// which compile you're looking at.
const now = new Date()
const pad = (n) => String(n).padStart(2, '0')
const buildId =
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
  `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`

const buildTime = now.toISOString()

/**
 * dist/version.json is what an open tab polls to learn a newer build is
 * live (src/app/UpdateCheck.jsx). It's served no-store (public/_headers), so
 * the answer is never a cached one.
 */
function versionFile() {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: pkg.version, buildId, buildTime }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  test: {
    environment: 'node',
  },
})
