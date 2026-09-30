/** @jest-environment node */
import { nodeResolve } from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import { resolve } from "path"
import { rollup } from "rollup"

/**
 * Bundles the built packages through their package.json exports, so
 * run `yarn build` first.
 */
const entry = resolve(__dirname, "virtual-entry.js")

jest.setTimeout(20000)

async function bundle(code: string, env: string) {
    const build = await rollup({
        input: entry,
        external: ["react", "react-dom", "react/jsx-runtime"],
        plugins: [
            {
                name: "virtual-entry",
                resolveId: (id) => (id === entry ? id : null),
                load: (id) => (id === entry ? code : null),
            },
            nodeResolve(),
            replace({
                preventAssignment: true,
                "process.env.NODE_ENV": JSON.stringify(env),
            }),
        ],
        onwarn: () => {},
    })
    const { output } = await build.generate({ format: "es" })
    await build.close()
    return output[0].code
}

/**
 * Only the dev implementation of `warning` in motion-utils' errors.ts
 * checks for `console`. `warnOnce` also formats troubleshooting links, but
 * it's meant to ship to production, so that URL isn't a reliable marker.
 */
const devWarnings = "typeof console"

const entries = [
    ["animate", `export { animate } from "motion"`],
    ["motion/mini animate", `export { animate } from "motion/mini"`],
    ["motion.div", `export { motion } from "motion/react"`],
    ["useSpring", `export { useSpring } from "motion/react"`],
]

describe("dev warnings in published entry points", () => {
    test("animate includes dev warnings in development", async () => {
        const output = await bundle(entries[0][1], "development")
        expect(output.includes(devWarnings)).toBe(true)
    })

    test.each(entries)(
        "%s drops dev warnings and NODE_ENV checks in production",
        async (_, code) => {
            const output = await bundle(code, "production")
            expect(output.includes(devWarnings)).toBe(false)
            expect(output.includes("NODE_ENV")).toBe(false)
        }
    )
})
