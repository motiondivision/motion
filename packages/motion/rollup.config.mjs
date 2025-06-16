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
    "react/jsx-runtime",
    "framer-motion/dom",
    "framer-motion/client",
    "framer-motion/m",
    "framer-motion/mini",
    "framer-motion/debug",
    "framer-motion/dom-mini",
    
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
 * Bundle seperately so bundles don't share common modules
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
    external: ["react", "react-dom", "react/jsx-runtime"],
    onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
        }
        warn(warning)
    }
})

const typePlugins = [dts({compilerOptions: {...tsconfig, baseUrl:"types"}})]

const types = {
    input: "types/index.d.ts",
    output: {
        format: "es",
        file: "dist/index.d.ts",
    },
    plugins: typePlugins,
}

const debugTypes = {
    input: "types/debug.d.ts",
    output: {
        format: "es",
        file: "dist/debug.d.ts",
    },
    plugins: typePlugins,
}

const reactTypes = {
    input: "types/react.d.ts",
    output: {
        format: "es",
        file: "dist/react.d.ts",
    },
    plugins: typePlugins,
}

const miniTypes = {
    input: "types/mini.d.ts",
    output: {
        format: "es",
        file: "dist/mini.d.ts",
    },
    plugins: typePlugins,
}

const mTypes = {
    input: "types/react-m.d.ts",
    output: {
        format: "es",
        file: "dist/react-m.d.ts",
    },
    plugins: typePlugins,
}

const reactMiniTypes = {
    input: "types/react-mini.d.ts",
    output: {
        format: "es",
        file: "dist/react-mini.d.ts",
    },
    plugins: typePlugins,
}

const clientTypes = {
    input: "types/react-client.d.ts",
    output: {
        format: "es",
        file: "dist/react-client.d.ts",
    },
    plugins: typePlugins,
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
    debugTypes,
    reactTypes,
    reactMiniTypes,
    mTypes,
    miniTypes,
    clientTypes,
]
