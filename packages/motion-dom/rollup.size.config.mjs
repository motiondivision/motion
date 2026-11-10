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

const motionValue = createSizeBundle(
    "lib/value/index.js",
    "dist/size-rollup-motion-value.js"
)

/**
 * Measures the public import, `styleEffect` alone. Taking the module as
 * the entry would also keep its other exports, such as the readers
 * animate() attaches.
 */
const styleEffectEntry = "\0size-entry-style-effect"
const styleEffect = createSizeBundle(
    styleEffectEntry,
    "dist/size-rollup-style-effect.js"
)
styleEffect.plugins = [
    {
        name: "size-entry",
        resolveId: (id) => (id === styleEffectEntry ? id : null),
        load: (id) =>
            id === styleEffectEntry
                ? `export { styleEffect } from ${JSON.stringify(
                      path.resolve("lib/effects/style/index.js")
                  )}`
                : null,
    },
    ...styleEffect.plugins,
]

const pinch = createSizeBundle(
    "lib/gestures/pinch/index.js",
    "dist/size-rollup-pinch.js"
)

export default [motionValue, styleEffect, pinch]
