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

const styleEffect = createSizeBundle(
    "lib/effects/style/index.js",
    "dist/size-rollup-style-effect.js"
)

// eslint-disable-next-line import/no-default-export
export default [motionValue, styleEffect]
