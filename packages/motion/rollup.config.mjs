import alias from "@rollup/plugin-alias"
import resolve from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import terser from "@rollup/plugin-terser"
import path from "node:path"
import dts from "rollup-plugin-dts"
import preserveDirectives from "rollup-plugin-preserve-directives"
import { fileURLToPath } from 'url'
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
    "react",
    "react-dom",
    "react/jsx-runtime",
    "motion-dom",
    "motion-utils",
    "framer-motion",
    "framer-motion/dom",
    "framer-motion/dom/mini",
    "framer-motion/client",
    "framer-motion/m",
    "framer-motion/mini",
    "framer-motion/debug",
    
]

const pureClass = {
    transform(code) {
        // Replace TS emitted @class function annotations with PURE so terser
        // can remove them
        return code.replace(/\/\*\* @class \*\//g, "/*@__PURE__*/")
    },
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shimReactJSXRuntimePlugin = alias({
    entries: [
        { find: 'react/jsx-runtime', replacement: path.resolve(__dirname, '../../dev/inc/jsxRuntimeShim.js') }
    ]
});

const umd = Object.assign({}, config, {
    output: {
        file: `dist/${pkg.name}.dev.js`,
        format: "umd",
        name: "Motion",
        exports: "named",
        globals: { react: "React", "react/jsx-runtime": "jsxRuntime" },
    },
    external: ["react", "react-dom"],
    plugins: [resolve(), replaceSettings("development"), shimReactJSXRuntimePlugin],
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

const umdProd = Object.assign({}, umd, {
    output: Object.assign({}, umd.output, {
        file: `dist/${pkg.name}.js`,
    }),
    plugins: [
        resolve(),
        replaceSettings("production"),
        pureClass,
        shimReactJSXRuntimePlugin,
        terser({ output: { comments: false } }),
    ],
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

const cjs = Object.assign({}, config, {
    input: "lib/index.js",
    output: {
        entryFileNames: `[name].js`,
        dir: "dist/cjs",
        format: "cjs",
        exports: "named",
        esModule: true
    },
    plugins: [resolve(), replaceSettings()],
    external,
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

/**
 * Bundle separately so bundles don't share common modules
 */
const cjsReact = Object.assign({}, cjs, { input : "lib/react.js" })
const cjsMini = Object.assign({}, cjs, { input : "lib/mini.js" })
const cjsDebug = Object.assign({}, cjs, { input : "lib/debug.js" })
const cjsReactMini = Object.assign({}, cjs, { input : "lib/react-mini.js" })
const cjsClient = Object.assign({}, cjs, { input : "lib/react-client.js" })
const cjsM = Object.assign({}, cjs, { input : "lib/react-m.js" })

export const es = Object.assign({}, config, {
    input: ["lib/index.js", "lib/mini.js", "lib/react.js", "lib/react-mini.js",  "lib/react-client.js", "lib/react-m.js", "lib/debug.js"],
    output: {
        entryFileNames: "[name].mjs",
        format: "es",
        exports: "named",
        preserveModules: true,
        dir: "dist/es",
    },
    plugins: [resolve(), replaceSettings(), preserveDirectives()],
    external,
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

const typePlugins = [dts({compilerOptions: {...tsconfig, baseUrl:"types"}, respectExternal: true})]

/**
 * Inline workspace packages so consumers get a single self-contained
 * .d.ts per entry point. See issue #2900.
 */
const internalToInline = ["framer-motion", "motion-dom", "motion-utils"]
const typesExternal = (id) => {
    if (id.startsWith(".")) return false
    if (internalToInline.some((pkg) => id === pkg || id.startsWith(pkg + "/"))) {
        return false
    }
    if (internalToInline.some((pkg) => id.includes(`/packages/${pkg}/`))) {
        return false
    }
    return true
}

/**
 * Single multi-input bundle so shared types (including global `Window`
 * augmentations from motion-dom) are extracted into a shared chunk rather
 * than duplicated per entry — duplication would cause TS2717 conflicts
 * when consumers import more than one entry.
 */
const types = {
    input: {
        index: "types/index.d.ts",
        debug: "types/debug.d.ts",
        react: "types/react.d.ts",
        mini: "types/mini.d.ts",
        "react-m": "types/react-m.d.ts",
        "react-mini": "types/react-mini.d.ts",
        "react-client": "types/react-client.d.ts",
    },
    output: {
        format: "es",
        dir: "dist",
        entryFileNames: "[name].d.ts",
        chunkFileNames: "shared/[name]-[hash].d.ts",
    },
    plugins: typePlugins,
    external: typesExternal,
}

// eslint-disable-next-line import/no-default-export
export default [
    umd,
    umdProd,
    cjs,
    cjsClient,
    cjsDebug,
    cjsReact,
    cjsMini,
    cjsReactMini,
    cjsM,
    es,
    types,
]
