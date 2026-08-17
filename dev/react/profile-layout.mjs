/**
 * Profiles a layout-animation stress example.
 *
 * Loads dev/react at ?example=<name>, starts Motion's recordStats() plus the
 * V8 sampling profiler, clicks to trigger the layout animation, then reports:
 * - frame rate + projection metrics (from recordStats)
 * - total sampled JS ms and per-frame JS ms
 * - self-time hotspots grouped by function
 * - time attributed to projection source vs everything else
 *
 * Usage: node profile-layout.mjs [example] [profileMs] [port]
 *   e.g. node profile-layout.mjs layout-stress 4000 9990
 */
import { chromium } from "playwright"
import { writeFileSync } from "fs"

const example = process.argv[2] || "layout-stress"
const profileMs = +(process.argv[3] || 4000)
const port = +(process.argv[4] || 9990)
/** ms to wait after the click before profiling (skips the didUpdate burst) */
const skipMs = process.argv[5] === undefined ? 600 : +process.argv[5]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
await page.goto(`http://localhost:${port}/?example=${example}`)
await page.waitForFunction(() => typeof window.recordStats === "function")
/** Let the initial mount settle */
await page.waitForTimeout(500)

const client = await page.context().newCDPSession(page)
await client.send("Profiler.enable")
await client.send("Profiler.setSamplingInterval", { interval: 100 })

/** Trigger the layout animation */
if (skipMs === 0) {
    await page.evaluate(() => {
        window.__report = window.recordStats()
    })
    await client.send("Profiler.start")
    await page.mouse.click(500, 500)
} else {
    await page.mouse.click(500, 500)

    /**
     * Skip the one-off measure/didUpdate burst at animation start so the
     * profile captures pure steady-state per-frame work.
     */
    await page.waitForTimeout(skipMs)

    await page.evaluate(() => {
        window.__report = window.recordStats()
    })
    await client.send("Profiler.start")
}

await page.waitForTimeout(profileMs)

const { profile } = await client.send("Profiler.stop")
const stats = await page.evaluate(() => window.__report())

/** ------------------------------------------------------------------ */
/** Aggregate the profile                                               */
/** ------------------------------------------------------------------ */

const nodesById = new Map()
for (const node of profile.nodes) nodesById.set(node.id, node)

const selfTime = new Map() // key -> µs
let totalSampled = 0
const totalWallUs = profile.endTime - profile.startTime

for (let i = 0; i < profile.samples.length; i++) {
    const delta = profile.timeDeltas[i] ?? 0
    const node = nodesById.get(profile.samples[i])
    if (!node) continue
    const { functionName, url, lineNumber } = node.callFrame
    if (functionName === "(idle)" || functionName === "(program)") continue
    totalSampled += delta
    const key = `${functionName || "(anonymous)"} @ ${url
        .split("/")
        .slice(-1)} :${lineNumber}`
    selfTime.set(key, (selfTime.get(key) || 0) + delta)
}

const sorted = [...selfTime.entries()].sort((a, b) => b[1] - a[1])

/**
 * Projection functions live in the framer-motion dep bundle; identify them by
 * name since the bundle is a single file. Names taken from
 * motion-dom/src/projection/** and geometry utils.
 */
const projectionNames =
    /projection|targetdelta|dirtynodes|calcprojection|calcrelative|calcboxdelta|calcaxisdelta|removeboxtransforms|applyboxdelta|applyaxisdelta|applytreedelta|boxequal|axisequal|aspectratio|translateaxis|transformbox|scalepoint|applypointdelta|hasscale|has2dtranslate|hastransform|buildprojectiontransform|measure|measurepagebox|measureviewportbox|convertboundingbox|updateprojection|updatelayout|updatesnapshot|notifylayoutupdate|resetskewandrotation|mixaxisdelta|mixbox|mixaxis|snapshot/i

let projectionUs = 0
for (const [key, us] of selfTime) {
    if (projectionNames.test(key)) projectionUs += us
}

const frames = stats.frameloop.rate
const frameCount = stats.layoutProjection.nodes.avg
    ? stats.layoutProjection.calculatedProjections.length ?? 0
    : 0

const out = {
    example,
    profileMs,
    fps: frames,
    projectionMetricsPerFrame: {
        nodes: stats.layoutProjection.nodes,
        calculatedTargetDeltas: stats.layoutProjection.calculatedTargetDeltas,
        calculatedProjections: stats.layoutProjection.calculatedProjections,
    },
    animations: stats.animations,
    js: {
        totalSampledMs: +(totalSampled / 1000).toFixed(1),
        wallMs: +(totalWallUs / 1000).toFixed(1),
        jsShareOfWall: +((totalSampled / totalWallUs) * 100).toFixed(1) + "%",
        projectionAttributedMs: +(projectionUs / 1000).toFixed(1),
        projectionShareOfJS:
            +((projectionUs / totalSampled) * 100).toFixed(1) + "%",
    },
    top30: sorted
        .slice(0, 30)
        .map(([key, us]) => `${(us / 1000).toFixed(1).padStart(7)}ms  ${key}`),
}

console.log(JSON.stringify(out, null, 2))
writeFileSync(
    `profile-${example}.json`,
    JSON.stringify({ out, profile }, null, 0)
)
console.log(`\nraw profile written to profile-${example}.json`)

await browser.close()
