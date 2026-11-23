/** @jest-environment node */
import { build, Plugin } from "esbuild"

/**
 * Some apps bundle Motion into a library first, then bundle that library
 * into their app. The first bundle flattens Motion into one module, so
 * `sideEffects: false` no longer helps the second. Only code without
 * top-level side effects can be dropped.
 *
 * Bundles the built packages through their package.json exports, so
 * run `yarn build` first.
 */
jest.setTimeout(20000)

const external = ["react", "react-dom", "react/jsx-runtime"]

async function flatten(code: string) {
    const result = await build({
        stdin: { contents: code, resolveDir: __dirname, loader: "js" },
        bundle: true,
        write: false,
        format: "esm",
        platform: "browser",
        external,
        define: { "process.env.NODE_ENV": '"production"' },
    })
    return result.outputFiles[0].text
}

async function importUnused(library: string) {
    const virtualLibrary: Plugin = {
        name: "virtual-library",
        setup(pluginBuild) {
            pluginBuild.onResolve({ filter: /^virtual-library$/ }, () => ({
                path: "virtual-library",
                namespace: "virtual",
            }))
            pluginBuild.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({
                contents: library,
                loader: "js",
            }))
        },
    }

    const result = await build({
        stdin: { contents: `import "virtual-library"`, loader: "js" },
        bundle: true,
        write: false,
        format: "esm",
        platform: "browser",
        external,
        plugins: [virtualLibrary],
    })
    return result.outputFiles[0].text
}

const countDeclarations = (code: string) =>
    code
        .split("\n")
        .filter((line) => /^(var|let|const|function|class) /.test(line)).length

async function survivors(code: string) {
    return countDeclarations(await importUnused(await flatten(code)))
}

describe("flat bundle tree-shaking", () => {
    test("the flattened bundle contains the imports", async () => {
        const library = await flatten(`export { motion } from "framer-motion"`)
        expect(countDeclarations(library)).toBeGreaterThan(300)
    })

    /**
     * What remains is mostly value types, frameloop setup and constants
     * that bundlers can't prove are free of side effects.
     */
    test.each([
        ["motion", `export { motion } from "framer-motion"`, 80],
        [
            "a typical React import set",
            `export {
                motion,
                AnimatePresence,
                LayoutGroup,
                LazyMotion,
                domAnimation,
                domDrag,
                domLayout,
                domMax,
                useMotionValue,
                useTransform,
                useSpring,
                useAnimate,
                useInView,
                useScroll,
                animate,
                frame,
                MotionValue,
                MotionGlobalConfig,
                addScaleCorrector,
                WillChangeMotionValue,
            } from "framer-motion"`,
            80,
        ],
        ["animate", `export { animate } from "motion"`, 80],
        ["frame", `export { frame } from "motion"`, 10],
    ])("unused %s mostly drops", async (_, code, ceiling) => {
        expect(await survivors(code)).toBeLessThanOrEqual(ceiling)
    })
})
