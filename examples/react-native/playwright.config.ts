import { chromium, defineConfig } from "@playwright/test"
import { existsSync } from "fs"
import { join } from "path"

const PORT = Number(process.env.PORT) || 8099

/**
 * Cloud containers ship a Chromium whose build can differ from the one this
 * Playwright pins. Use it when the pinned one isn't installed.
 */
const fallback =
    process.env.PLAYWRIGHT_BROWSERS_PATH &&
    join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium")

export default defineConfig({
    testDir: "./e2e",
    timeout: 20000,
    use: {
        baseURL: `http://localhost:${PORT}`,
        launchOptions:
            !existsSync(chromium.executablePath()) && fallback && existsSync(fallback)
                ? { executablePath: fallback }
                : {},
    },
    webServer: {
        command: "npm run web:build && node e2e/serve.mjs",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 300000,
        env: { PORT: String(PORT) },
    },
})
