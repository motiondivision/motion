/** @jest-environment node */
import resolve from "@rollup/plugin-node-resolve"
import { readFileSync } from "fs"
import { join } from "path"
import { rollup } from "rollup"

/**
 * `motion` components fetch their layout and drag code when a component
 * first needs it. That only makes the first load smaller if no file of the
 * first load shares a module with that code.
 *
 * Bundles the built packages through their package.json exports, so
 * run `yarn build` first.
 */
jest.setTimeout(60000)

const lazyOnly =
    /create-projection-node|projection\/(geometry\/delta-|animation\/)|VisualElementDragControls|gestures\/pan\/|components\/Reorder\//

async function firstLoadModules(code: string) {
    const bundle = await rollup({
        input: "entry",
        external: ["react", "react-dom", "react/jsx-runtime"],
        onwarn: () => {},
        plugins: [
            {
                name: "entry",
                resolveId: (id) => (id === "entry" ? id : null),
                load: (id) => (id === "entry" ? code : null),
            },
            resolve({ rootDir: __dirname }),
        ],
    })
    const { output } = await bundle.generate({ format: "es", dir: "out" })
    const chunks: Record<string, any> = {}
    for (const chunk of output) chunks[chunk.fileName] = chunk

    const first = new Set<string>()
    const walk = (fileName: string) => {
        if (first.has(fileName)) return
        first.add(fileName)
        chunks[fileName].imports
            .filter((name: string) => chunks[name])
            .forEach(walk)
    }
    walk(output.find((chunk: any) => chunk.isEntry)!.fileName)

    const modules: string[] = []
    for (const fileName of first) {
        for (const [id, info] of Object.entries<any>(
            chunks[fileName].modules
        )) {
            info.renderedLength && modules.push(id)
        }
    }
    return { modules, chunkCount: output.length }
}

describe("motion first load", () => {
    test.each([
        `import { motion } from "motion/react"; export const D = motion.div`,
        `import * as motion from "motion/react-client"; export const D = motion.div`,
    ])("has no layout, drag or reorder modules: %s", async (code) => {
        const { modules, chunkCount } = await firstLoadModules(code)

        expect(chunkCount).toBeGreaterThan(1)
        expect(modules.length).toBeGreaterThan(50)
        expect(modules.filter((id) => lazyOnly.test(id))).toEqual([])
    })

    /**
     * webpack keeps a whole namespace object when a module copies one of its
     * members into a local binding, such as `const motion = ns.motion`. With
     * `Reorder` in that namespace, drag code joins every first load.
     */
    test("motion/react re-exports motion without a local binding", () => {
        const source = readFileSync(
            join(__dirname, "../../dist/es/react.mjs"),
            "utf8"
        ).replace(/^\s*\/\/.*$/gm, "")
        expect(source).not.toMatch(/=\s*\w+\.(motion|Reorder)\b/)
        expect(source).toMatch(
            /export \{[^}]*\bmotion\b[^}]*\} from 'framer-motion\/async'/
        )
    })
})
