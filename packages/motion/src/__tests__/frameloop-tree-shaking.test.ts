/** @jest-environment node */
import { nodeResolve } from "@rollup/plugin-node-resolve"
import replace from "@rollup/plugin-replace"
import { resolve } from "path"
import { rollup } from "rollup"

const entry = resolve(__dirname, "virtual-entry.js")

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
 * The frameloop is the only code in these bundles that schedules
 * with requestAnimationFrame.
 */
const frameloop = "requestAnimationFrame"

describe("frameloop tree-shaking of published entry points", () => {
    test("full animate includes the frameloop", async () => {
        expect(await bundle(`export { animate } from "motion"`)).toContain(
            frameloop
        )
    })

    test.each([
        ["motion/mini animate", `export { animate } from "motion/mini"`],
        ["animateView", `export { animateView } from "motion"`],
    ])("%s does not include the frameloop", async (_, code) => {
        const output = await bundle(code)
        expect(output).toContain("__MOTION_INSPECT__")
        expect(output).not.toContain(frameloop)
    })
})
