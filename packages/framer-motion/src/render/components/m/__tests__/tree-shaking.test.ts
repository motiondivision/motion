/**
 * @jest-environment node
 */
import { buildSync } from "esbuild"
import * as path from "path"

const packages = path.resolve(__dirname, "../../../../../..")

function bundle(contents: string) {
    return buildSync({
        stdin: { contents, resolveDir: __dirname, loader: "ts" },
        bundle: true,
        write: false,
        format: "esm",
        external: ["react", "react-dom", "react/jsx-runtime"],
        alias: {
            "motion-dom": path.join(packages, "motion-dom/src/index.ts"),
            "motion-utils": path.join(packages, "motion-utils/src/index.ts"),
        },
        define: { "process.env.NODE_ENV": '"production"' },
    }).outputFiles[0].text
}

const layoutCorrectorCanaries = ["boxShadow", "hsla("]

const findCanaries = (code: string) =>
    layoutCorrectorCanaries.filter((canary) => code.includes(canary))

describe("m tree-shaking", () => {
    test("m.div doesn't include the layout scale correctors", () => {
        const code = bundle(`export { div } from "../../../../m"`)

        expect(code.includes("createMinimalMotionComponent")).toBe(true)
        expect(findCanaries(code)).toEqual([])
    })

    test("domDrag excludes layout projection and scale correctors", () => {
        const code = bundle(
            `export { domDrag } from "../../../dom/features-drag"`
        )

        expect(code.includes("VisualElementDragControls")).toBe(true)
        expect(code.includes("createProjectionNode")).toBe(false)
        expect(code.includes("MeasureLayoutWithContext")).toBe(false)
        expect(code.includes("correctBoxShadow")).toBe(false)
        expect(code.includes("correctBorderRadius")).toBe(false)
    })

    test("domLayout includes layout projection and excludes drag and pan", () => {
        const code = bundle(
            `export { domLayout } from "../../../dom/features-layout"`
        )

        expect(code.includes("createProjectionNode")).toBe(true)
        expect(findCanaries(code)).toEqual(layoutCorrectorCanaries)
        expect(code.includes("VisualElementDragControls")).toBe(false)
        expect(code.includes("PanSession")).toBe(false)
    })

    test("domMax includes the layout scale correctors", () => {
        const code = bundle(
            `export { domMax } from "../../../dom/features-max"`
        )

        expect(findCanaries(code)).toEqual(layoutCorrectorCanaries)
        expect(code.includes("VisualElementDragControls")).toBe(true)
        expect(code.includes("createProjectionNode")).toBe(true)
    })
})
