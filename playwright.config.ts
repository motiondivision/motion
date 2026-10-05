import { chromium, defineConfig, devices } from "@playwright/test"
import { existsSync } from "fs"
import { join } from "path"

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * If the Chromium build pinned by this Playwright version isn't installed,
 * fall back to a preinstalled Chromium. Cloud containers ship one at
 * $PLAYWRIGHT_BROWSERS_PATH/chromium whose build can differ from the pinned
 * one. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to point at any other build.
 */
const chromiumFallback =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.env.PLAYWRIGHT_BROWSERS_PATH &&
        join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium"))

const chromiumLaunchOptions =
    !existsSync(chromium.executablePath()) &&
    chromiumFallback &&
    existsSync(chromiumFallback)
        ? { executablePath: chromiumFallback }
        : {}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./tests",
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: "html",
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: "http://localhost:8000/playwright/",

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: "on-first-retry",
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                launchOptions: chromiumLaunchOptions,
            },
            testIgnore: /tests\/react\//,
        },

        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testIgnore: /tests\/react\//,
        },

        /**
         * React 19 dev app. Used for React-only behaviour that needs a real
         * browser, e.g. view transitions, which Cypress' Electron can't run.
         */
        {
            name: "react-19",
            testMatch: /tests\/react\/.*\.spec\.ts/,
            use: {
                ...devices["Desktop Chrome"],
                launchOptions: chromiumLaunchOptions,
                baseURL: "http://localhost:9991/",
            },
        },
    ],

    /* Run local dev servers before starting the tests */
    webServer: [
        {
            command: "yarn dev",
            url: "http://localhost:8000",
            reuseExistingServer: !process.env.CI,
            cwd: "./dev/html",
        },
        {
            command: "yarn dev",
            url: "http://localhost:9991",
            reuseExistingServer: !process.env.CI,
            cwd: "./dev/react-19",
        },
    ],
})
