import path from "path"
import resolve from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import { visualizer } from "rollup-plugin-visualizer"
import { es, replaceSettings } from "./rollup.config.mjs"

const sizePlugins = [
    resolve(),
    replaceSettings("production"),
    terser({ output: { comments: false } }),
]

const external = ["react", "react-dom", "react/jsx-runtime"]

function createSizeBundle(input, output) {
    return Object.assign({}, es, {
        input,
        output: Object.assign({}, es.output, {
            file: output,
            preserveModules: false,
            dir: undefined,
        }),
        plugins: [...sizePlugins, visualizer()],
        external,
        onwarn(warning, warn) {
            if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
                return
            }
            warn(warning)
        },
    })
}

const motion = createSizeBundle(
    "lib/render/components/motion/size.js",
    "dist/size-rollup-motion.js"
)
const m = createSizeBundle(
    "lib/render/components/m/size.js",
    "dist/size-rollup-m.js"
)
const sizeAnimate = createSizeBundle(
    "lib/animation/animate/index.js",
    "dist/size-rollup-animate.js"
)
const sizeScroll = createSizeBundle(
    "lib/render/dom/scroll/index.js",
    "dist/size-rollup-scroll.js"
)
const sizeAnimateMini = createSizeBundle(
    "lib/animation/animators/waapi/animate-style.js",
    "dist/size-rollup-waapi-animate.js"
)

/**
 * Bundles several modules into one file. Passing them as separate inputs
 * would move their shared modules into a chunk that no budget counts.
 */
function createCombinedSizeBundle(inputs, output) {
    const id = `\0${output}`
    const code = inputs
        .map((input) => `export * from ${JSON.stringify(path.resolve(input))}`)
        .join("\n")
    const bundle = createSizeBundle(id, output)
    bundle.plugins = [
        {
            name: "size-entry",
            resolveId: (i) => (i === id ? id : null),
            load: (i) => (i === id ? code : null),
        },
        ...bundle.plugins,
    ]
    return bundle
}

const lazyM = [
    "lib/render/components/m/size.js",
    "lib/components/LazyMotion/index.js",
]
const domAnimation = createCombinedSizeBundle(
    [...lazyM, "lib/render/dom/features-animation.js"],
    "dist/size-rollup-m-dom-animation.js"
)
const domMax = createCombinedSizeBundle(
    [...lazyM, "lib/render/dom/features-max.js"],
    "dist/size-rollup-m-dom-max.js"
)

export default [
    motion,
    m,
    sizeAnimate,
    sizeScroll,
    domAnimation,
    domMax,
    sizeAnimateMini,
]
