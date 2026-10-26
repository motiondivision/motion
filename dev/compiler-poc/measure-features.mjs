/**
 * What a compiler could remove, measured by bundling the motion component
 * with hand-picked feature packages (rollup + terser + gzip, as in
 * dev/inc/size-scenarios.mjs). Sizes are kB (1000 B).
 *
 *   node dev/compiler-poc/measure-features.mjs
 */
import fs from "fs"
import * as esbuild from "esbuild"
import zlib from "zlib"
import { promisify } from "util"
import { rollup } from "rollup"
import resolve from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"
import { fileURLToPath } from "url"
const root = fileURLToPath(new URL("../..", import.meta.url))
const FM = root + "packages/framer-motion/dist/es/"
const MD = root + "packages/motion-dom/dist/es/"
const external = ["react", "react-dom", "react/jsx-runtime", "react-dom/client"]
const minify = terser({ output: { comments: false } })
export async function measure(code, dump) {
    code = code.replaceAll("FM/", FM).replaceAll("MD/", MD)
    const b = await rollup({
        input: "\0entry",
        external,
        onwarn: () => {},
        plugins: [
            {
                name: "v",
                resolveId: (i) => (i === "\0entry" ? i : null),
                load: (i) => (i === "\0entry" ? code : null),
            },
            resolve({ rootDir: root }),
            replace({
                "process.env.NODE_ENV": JSON.stringify("production"),
                preventAssignment: false,
            }),
            minify,
        ],
    })
    const { output } = await b.generate({ format: "es" })
    await b.close()
    const buf = Buffer.from(output[0].code)
    if (dump) fs.writeFileSync(dump, buf)
    return { min: buf.length, gz: (await promisify(zlib.gzip)(buf)).length }
}
export async function attr(code) {
    code = code.replaceAll("FM/", FM).replaceAll("MD/", MD)
    const res = await esbuild.build({
        stdin: { contents: code, resolveDir: root, loader: "js" },
        bundle: true,
        minify: true,
        format: "esm",
        write: false,
        external,
        define: { "process.env.NODE_ENV": '"production"' },
        metafile: true,
        logLevel: "silent",
        target: "es2020",
    })
    const out = Object.values(res.metafile.outputs)[0]
    return Object.fromEntries(
        Object.entries(out.inputs).map(([id, m]) => [
            id
                .replace(/^.*?packages\//, "")
                .replace("/dist/es/", ":")
                .replace(/\.mjs$/, ""),
            m.bytesInOutput,
        ])
    )
}

const lazy = `import { m, LazyMotion } from "motion/react"; export { m, LazyMotion };`
const html = `import { HTMLVisualElement } from "motion-dom"; const renderer = (C, o) => new HTMLVisualElement(o, { allowProjection: false });`
const scenarios = {
    "baseline motion.div": `import { motion } from "motion/react"; export const D = motion.div`,
    "baseline m+domAnimation": `export { m, LazyMotion, domAnimation } from "motion/react"`,
    "m+domMin (animate+exit)": `export { m, LazyMotion, domMin } from "motion/react"`,
    "m+{renderer,animation}":
        lazy +
        `import { createDomVisualElement } from "FM/render/dom/create-visual-element.mjs"; import { AnimationFeature } from "FM/motion/features/animation/index.mjs"; export const f = { renderer: createDomVisualElement, animation: { Feature: AnimationFeature } }`,
    "m+{HTML renderer,animation}":
        lazy +
        html +
        `import { AnimationFeature } from "FM/motion/features/animation/index.mjs"; export const f = { renderer, animation: { Feature: AnimationFeature } }`,
    "m+{HTML renderer,animation,hover}":
        lazy +
        html +
        `import { AnimationFeature } from "FM/motion/features/animation/index.mjs"; import { HoverGesture } from "FM/gestures/hover.mjs"; export const f = { renderer, animation: { Feature: AnimationFeature }, hover: { Feature: HoverGesture } }`,
    "m+{HTML renderer,animation,exit,hover,tap,inView}":
        lazy +
        html +
        `import { AnimationFeature } from "FM/motion/features/animation/index.mjs"; import { ExitAnimationFeature } from "FM/motion/features/animation/exit.mjs"; import { HoverGesture } from "FM/gestures/hover.mjs"; import { PressGesture } from "FM/gestures/press.mjs"; import { InViewFeature } from "FM/motion/features/viewport/index.mjs"; export const f = { renderer, animation: { Feature: AnimationFeature }, exit: { Feature: ExitAnimationFeature }, hover: { Feature: HoverGesture }, tap: { Feature: PressGesture }, inView: { Feature: InViewFeature } }`,
    "renderer only (HTML), no animation":
        lazy + html + `export const f = { renderer }`,
    "m only": lazy,
    "mini motion.div": `import { motion } from "motion/react-mini"; export const D = motion.div`,
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    for (const [name, code] of Object.entries(scenarios)) {
        const r = await measure(code)
        console.log(
            name.padEnd(52),
            (r.min / 1000).toFixed(2).padStart(8),
            (r.gz / 1000).toFixed(2).padStart(7)
        )
    }
}
