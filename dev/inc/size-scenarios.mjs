/**
 * Measure min + gzip + brotli size of real public-entry-point import
 * scenarios, bundled from the built `motion` package the way users consume
 * it (package `exports`, `sideEffects: false`, NODE_ENV=production).
 *
 * Usage (from repo root, after `yarn build`):
 *   yarn size                            # table
 *   yarn size --json out.json            # also write the results as JSON
 *   yarn size --compare base.json        # Δ columns vs a saved --json run
 *   yarn size --check                    # exit 1 on a budget breach or leak
 *   yarn size --update-budgets           # set budgets to actuals + 1%
 *   yarn size --only motion-div,m-div    # subset; combines with the above
 *   yarn size --attr motion-div [--top 60]
 *   yarn size --dump m-div [--out /tmp/m-div.js]
 *
 * Gzip is zlib's default level, as in dev/inc/bundlesize.mjs. Budgets are
 * gzip bytes in size-budgets.json. Rollup + terser mirrors
 * packages/framer-motion/rollup.size.config.mjs. esbuild is a second,
 * independent tree-shaker: a large rollup/esbuild gap on a scenario usually
 * means a side-effect/tree-shaking hazard.
 */
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"
import zlib from "zlib"
import { rollup } from "rollup"
import resolve from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"
import * as esbuild from "esbuild"

const root = fileURLToPath(new URL("../..", import.meta.url))
const budgetsPath = fileURLToPath(new URL("size-budgets.json", import.meta.url))
const external = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"]

const combo = (exports) =>
    `import { motion, ${exports} } from "motion/react"; export const D = motion.div; export { ${exports} }`

export const scenarios = {
    // Vanilla
    animate: `export { animate } from "motion"`,
    "mini-animate": `export { animate } from "motion/mini"`,
    "animate-sequence": `import { animate } from "motion"; export const a = () => animate([["div", { x: 1 }]])`,
    scroll: `export { scroll } from "motion"`,
    "scroll+animate": `export { scroll, animate } from "motion"`,
    inView: `export { inView } from "motion"`,
    resize: `export { resize } from "motion"`,
    "hover+press": `export { hover, press } from "motion"`,
    motionValue: `export { motionValue } from "motion"`,
    styleEffect: `export { styleEffect } from "motion"`,
    animateView: `export { animateView } from "motion"`,
    stagger: `export { stagger } from "motion"`,
    frame: `export { frame, cancelFrame } from "motion"`,
    mix: `export { mix } from "motion"`,
    "vanilla-all": `export * from "motion"`,

    // React components
    "motion-div": `import { motion } from "motion/react"; export const D = motion.div`,
    "motion-create": `import { motion } from "motion/react"; export const D = motion.create("div")`,
    "m-div": `export { div } from "motion/react-m"`,
    "m-div(via motion/react)": `import { m } from "motion/react"; export const D = m.div`,
    "m+LazyMotion+domAnimation": `export { m, LazyMotion, domAnimation } from "motion/react"`,
    "m+LazyMotion+domMax": `export { m, LazyMotion, domMax } from "motion/react"`,
    "LazyMotion-only": `export { LazyMotion } from "motion/react"`,
    "domAnimation-only": `export { domAnimation } from "motion/react"`,
    "domMax-only": `export { domMax } from "motion/react"`,
    AnimatePresence: `export { AnimatePresence } from "motion/react"`,
    MotionConfig: `export { MotionConfig } from "motion/react"`,
    LayoutGroup: `export { LayoutGroup } from "motion/react"`,
    Reorder: `export { Reorder } from "motion/react"`,

    // React hooks
    useMotionValue: `export { useMotionValue } from "motion/react"`,
    useTransform: `export { useTransform } from "motion/react"`,
    useMotionTemplate: `export { useMotionTemplate } from "motion/react"`,
    useSpring: `export { useSpring } from "motion/react"`,
    useScroll: `export { useScroll } from "motion/react"`,
    useInView: `export { useInView } from "motion/react"`,
    useAnimate: `export { useAnimate } from "motion/react"`,
    "useAnimate(mini)": `export { useAnimate } from "motion/react-mini"`,
    useMotionValueEvent: `export { useMotionValueEvent } from "motion/react"`,
    useReducedMotion: `export { useReducedMotion } from "motion/react"`,
    useAnimationFrame: `export { useAnimationFrame } from "motion/react"`,
    useVelocity: `export { useVelocity } from "motion/react"`,
    useAnimationControls: `export { useAnimationControls } from "motion/react"`,
    "react-all": `export * from "motion/react"`,

    // Combinations (marginal cost of mixing APIs in one app)
    "motion-div+AnimatePresence": combo("AnimatePresence"),
    "motion-div+useAnimate": combo("useAnimate"),
    "motion-div+animate": combo("animate"),
    "motion-div+useInView": combo("useInView"),
    "motion-div+useScroll": combo("useScroll"),
    "motion-div+useTransform+useMotionTemplate": combo(
        "useTransform, useMotionTemplate"
    ),
    "motion-div+useScroll+useTransform+useSpring": combo(
        "useScroll, useTransform, useSpring"
    ),
    "motion-div+Reorder": combo("Reorder"),
    "domMax+useScroll": `export { domMax, useScroll } from "motion/react"`,
}

/**
 * Strings that must not appear in a scenario's minified bundle. `"*"` checks
 * every scenario.
 *
 * `knownLeak: true` marks a leak that is still present on main. It's reported
 * without failing --check. Once no listed scenario contains the string any
 * more, --check fails until the PR that fixed the leak deletes that line, so
 * the canary then guards against regressions.
 */
export const canaries = [
    {
        scenarios: ["m-div"],
        forbid: "hsla(",
        why: "Default scale correctors pull the colour parser into m (plan 037)",
        knownLeak: true,
    },
    {
        scenarios: ["m-div"],
        forbid: "boxShadow",
        why: "Default scale correctors are bundled into m (plan 037)",
        knownLeak: true,
    },
    {
        scenarios: ["mini-animate"],
        forbid: "requestAnimationFrame",
        why: "The frameloop batcher is bundled into motion/mini",
    },
    {
        scenarios: ["scroll", "useScroll"],
        forbid: "hsla(",
        why: "Scroll offsets pull in the colour parser",
    },
    {
        scenarios: "*",
        forbid: "typeof console",
        why: "The dev-only warning body survives production dead-code elimination (plan 036)",
        knownLeak: true,
    },
]

const virtual = (code) => ({
    name: "virtual-entry",
    resolveId: (id) => (id === "\0entry" ? id : null),
    load: (id) => (id === "\0entry" ? code : null),
})

const gzip = async (buf) => (await promisify(zlib.gzip)(buf)).length
const brotli = async (buf) =>
    (
        await promisify(zlib.brotliCompress)(buf, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
        })
    ).length

/**
 * One instance so concurrent bundles share a single worker pool.
 */
const minify = terser({ output: { comments: false } })

/**
 * Module cache shared by every scenario build, filled by `warmCache`.
 */
let cache

const rollupOptions = (code) => ({
    input: "\0entry",
    cache,
    external,
    onwarn: () => {},
    plugins: [
        virtual(code),
        resolve({ rootDir: root }),
        replace({
            "process.env.NODE_ENV": JSON.stringify("production"),
            preventAssignment: false,
        }),
        minify,
    ],
})

async function warmCache() {
    const bundle = await rollup(
        rollupOptions(
            [
                "motion",
                "motion/mini",
                "motion/react",
                "motion/react-m",
                "motion/react-mini",
            ]
                .map((entry) => `import "${entry}"`)
                .join("\n")
        )
    )
    cache = bundle.cache
    await bundle.close()
}

async function bundleRollup(code, withModules = false) {
    const bundle = await rollup(rollupOptions(code))
    const { output } = await bundle.generate({ format: "es" })
    await bundle.close()
    const chunk = output[0]
    const buf = Buffer.from(chunk.code)
    const [gz, br] = await Promise.all([gzip(buf), brotli(buf)])
    const result = { min: buf.length, gz, br, code: chunk.code }
    if (withModules) {
        result.modules = Object.entries(chunk.modules).map(([id, m]) => [
            id,
            m.renderedLength,
        ])
    }
    return result
}

async function bundleEsbuild(code, withMeta = false) {
    const res = await esbuild.build({
        stdin: { contents: code, resolveDir: root, loader: "js" },
        bundle: true,
        minify: true,
        format: "esm",
        write: false,
        external,
        define: { "process.env.NODE_ENV": '"production"' },
        metafile: withMeta,
        logLevel: "silent",
        target: "es2020",
    })
    const buf = Buffer.from(res.outputFiles[0].contents)
    const result = { min: buf.length, gz: await gzip(buf) }
    if (withMeta) {
        const out = Object.values(res.metafile.outputs)[0]
        result.modules = Object.entries(out.inputs).map(([id, m]) => [
            id,
            m.bytesInOutput,
        ])
    }
    return result
}

const shortId = (id) =>
    id
        .replace(/^.*?packages\//, "")
        .replace("/dist/es/", ":")
        .replace(/\.mjs$/, "")

function arg(name) {
    const i = process.argv.indexOf(name)
    return i === -1 ? undefined : process.argv[i + 1] ?? true
}

const flag = (name) => process.argv.includes(name)

function getScenario(name) {
    const code = scenarios[name]
    if (!code) throw new Error(`Unknown scenario ${name}`)
    return code
}

async function attribution(name) {
    const code = getScenario(name)
    const top = Number(arg("--top") ?? 60)
    const [r, e] = await Promise.all([
        bundleRollup(code),
        bundleEsbuild(code, true),
    ])
    console.log(
        `\n${name}: rollup ${r.min} B min / ${r.gz} B gz; esbuild ${e.min} B min / ${e.gz} B gz`
    )
    console.log(
        `\nPer-module minified bytes (esbuild bytesInOutput), top ${top}:`
    )
    const total = e.modules.reduce((a, [, b]) => a + b, 0)
    e.modules
        .sort((a, b) => b[1] - a[1])
        .slice(0, top)
        .forEach(([id, b]) =>
            console.log(
                String(b).padStart(7),
                ((b / total) * 100).toFixed(1).padStart(5) + "%",
                shortId(id)
            )
        )
    const byPkg = {}
    for (const [id, b] of e.modules) {
        const pkg = shortId(id).split(":")[0]
        byPkg[pkg] = (byPkg[pkg] || 0) + b
    }
    console.log("\nBy package:", byPkg)
    console.log(`Modules included: ${e.modules.length}`)
}

async function mapLimit(items, limit, fn) {
    const results = []
    let next = 0
    const worker = async () => {
        while (next < items.length) {
            const i = next++
            results[i] = await fn(items[i])
        }
    }
    await Promise.all(Array.from({ length: limit }, worker))
    return results
}

function printTable(rows) {
    const widths = rows[0].map((_, i) =>
        Math.max(...rows.map((row) => row[i].length))
    )
    for (const row of rows) {
        console.log(
            row
                .map((c, i) =>
                    i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])
                )
                .join("  ")
        )
    }
}

const toBudget = (gz) => Math.ceil((gz * 1.01) / 50) * 50

/**
 * Returns the list of --check failures.
 */
function check(results, codes, budgets) {
    const failures = []

    for (const [name, { gz }] of Object.entries(results)) {
        const budget = budgets[name]
        if (budget === undefined) {
            failures.push(`${name} has no budget in size-budgets.json`)
        } else if (gz > budget) {
            failures.push(`${name} is ${gz} B gz (${budget} B allowed)`)
        }
    }

    console.log("\nLeak canaries:")
    for (const { scenarios: names, forbid, why, knownLeak } of canaries) {
        const listed = names === "*" ? Object.keys(scenarios) : names
        const measured = listed.filter((name) => codes[name] !== undefined)
        if (!measured.length) continue

        const leaking = measured.filter((name) => codes[name].includes(forbid))
        const label = `"${forbid}" in ${
            names === "*" ? "any scenario" : names.join(", ")
        }`
        const found =
            leaking.length > 5
                ? `${leaking.length} scenarios`
                : leaking.join(", ")

        if (knownLeak && leaking.length) {
            console.log(`  known leak  ${label}: ${why}. Found in ${found}`)
        } else if (knownLeak && measured.length < listed.length) {
            console.log(`  skipped     ${label}: not in the --only scenarios`)
        } else if (knownLeak) {
            failures.push(
                `Leak ${label} is fixed: delete its \`knownLeak: true\` line in dev/inc/size-scenarios.mjs`
            )
        } else if (leaking.length) {
            failures.push(`Leak ${label}: ${why}. Found in ${found}`)
        } else {
            console.log(`  ok          ${label}`)
        }
    }

    return failures
}

async function main() {
    const attr = arg("--attr")
    if (attr) return attribution(attr)

    const dump = arg("--dump")
    if (dump) {
        const out = arg("--out") ?? `/tmp/size-${dump}.js`
        fs.writeFileSync(out, (await bundleRollup(getScenario(dump))).code)
        return console.log(`Wrote ${out}`)
    }

    const only = arg("--only")
    const names = only ? String(only).split(",") : Object.keys(scenarios)
    names.forEach(getScenario)

    const compare = arg("--compare")
    const base = compare ? JSON.parse(fs.readFileSync(compare, "utf8")) : null
    const budgets = JSON.parse(fs.readFileSync(budgetsPath, "utf8"))

    await warmCache()

    const results = {}
    const codes = {}
    const measured = await mapLimit(
        names,
        Math.max(2, os.availableParallelism?.() ?? os.cpus().length),
        async (name) => {
            const code = scenarios[name]
            return Promise.all([bundleRollup(code), bundleEsbuild(code)])
        }
    )
    names.forEach((name, i) => {
        const [r, e] = measured[i]
        codes[name] = r.code
        results[name] = {
            min: r.min,
            gz: r.gz,
            br: r.br,
            esbuildMin: e.min,
            esbuildGz: e.gz,
        }
    })

    const kb = (n) => (n / 1024).toFixed(2)
    const signed = (n) => (n > 0 ? `+${n}` : String(n))
    const rows = [
        [
            "scenario",
            "min kB",
            "gz kB",
            "br kB",
            "esb gz kB",
            "budget kB",
            ...(base ? ["Δgz B", "Δmin B"] : []),
        ],
    ]
    for (const [name, r] of Object.entries(results)) {
        const b = base?.[name]
        rows.push([
            name,
            kb(r.min),
            kb(r.gz),
            kb(r.br),
            kb(r.esbuildGz),
            budgets[name] ? kb(budgets[name]) : "-",
            ...(base
                ? [
                      b ? signed(r.gz - b.gz) : "n/a",
                      b ? signed(r.min - b.min) : "n/a",
                  ]
                : []),
        ])
    }
    printTable(rows)

    const json = arg("--json")
    if (json) {
        fs.writeFileSync(json, JSON.stringify(results, null, 2) + "\n")
        console.log(`\nWrote ${path.resolve(json)}`)
    }

    if (flag("--update-budgets")) {
        for (const [name, { gz }] of Object.entries(results)) {
            budgets[name] = toBudget(gz)
        }
        const ordered = {}
        for (const name of Object.keys(scenarios)) {
            if (budgets[name] !== undefined) ordered[name] = budgets[name]
        }
        fs.writeFileSync(budgetsPath, JSON.stringify(ordered, null, 4) + "\n")
        console.log(`\nWrote ${budgetsPath}`)
    }

    if (flag("--check")) {
        const failures = check(results, codes, budgets)
        if (failures.length) {
            console.error(`\n${failures.length} size check(s) failed:`)
            failures.forEach((f) => console.error(`  ❌ ${f}`))
            process.exit(1)
        }
        console.log("\n✅ All scenarios within budget, no new leaks")
    }
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
