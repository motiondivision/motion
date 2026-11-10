/**
 * motion/fx for dev pages and Playwright tests, with the origin trial
 * shim installed first so older Chromium builds can run them.
 */
import { installTrialShim } from "./canvas-trial-shim.js"

/**
 * ?noshim leaves the browser as it is, to test the unsupported path.
 */
export const htmlInCanvas = new URLSearchParams(location.search).has("noshim")
    ? "none"
    : installTrialShim()

export * from "motion/fx"
export {
    animate,
    drag,
    frame,
    frameData,
    hover,
    motionValue,
    MotionGlobalConfig,
    press,
    processFrame,
} from "motion"
