import resolve from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import sourcemaps from "rollup-plugin-sourcemaps"
import dts from "rollup-plugin-dts"
import preserveDirectives from "rollup-plugin-preserve-directives"
import pkg from "./package.json" with { type: "json" }
import tsconfig from "./tsconfig.json" with { type: "json" }

const config = {
    input: "lib/index.js",
}

export const replaceSettings = (env) => {
    const replaceConfig = env
        ? {
              "process.env.NODE_ENV": JSON.stringify(env),
              preventAssignment: false,
          }
        : {
              preventAssignment: false,
          }

    return replace(replaceConfig)
}

const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
    "react/jsx-runtime",
]

const cjs = Object.assign({}, config, {
    input: "lib/index.js",
    output: {
        entryFileNames: `[name].js`,
        dir: "dist/cjs",
        format: "cjs",
        exports: "named",
        esModule: true,
        sourcemap: true,
    },
    plugins: [resolve(), replaceSettings(), sourcemaps()],
    external,
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

export const es = Object.assign({}, config, {
    input: ["lib/index.js"],
    output: {
        entryFileNames: "[name].mjs",
        format: "es",
        exports: "named",
        preserveModules: true,
        dir: "dist/es",
        sourcemap: true,
    },
    plugins: [resolve(), replaceSettings(), preserveDirectives(), sourcemaps()],
    external,
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

const typePlugins = [dts({compilerOptions: {...tsconfig, baseUrl:"types"}})]

function createTypes(input, file) {
    return {
        input,
        output: {
            format: "es",
            file: file,
        },
        plugins: typePlugins,
    }
}

const types = createTypes("types/index.d.ts", "dist/index.d.ts")

// eslint-disable-next-line import/no-default-export
export default [
    cjs,
    es,
    types,
]
