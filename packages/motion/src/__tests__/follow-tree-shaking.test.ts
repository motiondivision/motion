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

async function bundle(code: string) {
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
                "process.env.NODE_ENV": JSON.stringify("production"),
            }),
        ],
        onwarn: () => {},
    })
    const { output } = await build.generate({ format: "es" })
    await build.close()
    return output[0].code
}

/**
 * Only the inertia generator reads `timeConstant`.
 */
const inertia = "timeConstant"

describe("spring followers tree-shake other generators", () => {
    test.each([
        ["followValue", `export { followValue } from "motion"`],
        ["useFollowValue", `export { useFollowValue } from "motion/react"`],
    ])("%s includes every generator", async (_, code) => {
        expect((await bundle(code)).includes(inertia)).toBe(true)
    })

    test.each([
        ["springValue", `export { springValue } from "motion"`],
        ["attachSpring", `export { attachSpring } from "motion"`],
        ["useSpring", `export { useSpring } from "motion/react"`],
    ])("%s only includes the spring generator", async (_, code) => {
        expect((await bundle(code)).includes(inertia)).toBe(false)
    })
})
