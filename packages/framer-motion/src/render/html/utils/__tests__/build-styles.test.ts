import "../../../../jest.setup"
import { DOMVisualElementOptions } from "../../../dom/types"
import { ResolvedValues } from "../../../types"
import { TransformOrigin } from "../../types"
import { buildHTMLStyles } from "../build-styles"

describe("buildHTMLStyles", () => {
    test("Builds basic styles", () => {
        const latest = { width: 100 }
        const style = {}
        build(latest, { style })

        expect(style).toEqual({ width: "100px" })
    })

    test("Builds vars", () => {
        const latest = { "--width": 100 }
        const vars = {}
        build(latest, { vars })

        expect(vars).toEqual({ "--width": 100 })
    })

    test("Builds transform with default value types", () => {
        const latest = { x: 1, y: 0, rotateX: 90, transformPerspective: 200 }
        const style = {}
        build(latest, { style })

        expect(style).toEqual({
            transform: "perspective(200px) translateX(1px) rotateX(90deg)",
        })
    })

    test("Builds perspective into the CSS perspective style", () => {
        const latest = { perspective: 100, transform: "translateX(100px)" }
        const style = {}
        build(latest, { style })

        expect(style).toEqual({
            perspective: "100px",
            transform: "translateX(100px)",
        })
    })

    test("Builds transform with defined value types", () => {
        const latest = { x: "1vw", y: "2%", rotateX: "90turn" }
        const style = {}
        build(latest, { style })

        expect(style).toEqual({
            transform: "translateX(1vw) translateY(2%) rotateX(90turn)",
        })
    })

    test("Builds transform none if all transforms are default", () => {
        const latest = { x: 0, y: 0, scale: 1 }
        const style = {}
        build(latest, { style })

        expect(style).toEqual({
            transform: "none",
        })
    })

    test("Builds transformOrigin with correct default value types", () => {
        const latest = { originX: 0.2, originY: "60%", originZ: 10 }
        const style = {}
        build(latest, { style })

        expect(style).toEqual({
            transformOrigin: "20% 60% 10px",
        })
    })

    test("Applies transformTemplate if provided", () => {
        const latest = { x: 1 }
        const style = {}
        build(latest, {
            style,
            config: {
                transformTemplate: ({ x }: any, gen: any) =>
                    `translateY(${parseFloat(x as string) * 2}) ${gen}`,
            },
        })

        expect(style).toEqual({
            transform: "translateY(2) translateX(1px)",
        })
    })

    test("Applies transformTemplate if provided", () => {
        const latest = { x: 1 }
        const style = {}
        build(latest, {
            style,
            config: {
                transformTemplate: ({ x }: any, gen: any) =>
                    `translateY(${parseFloat(x as string) * 2}) ${gen}`,
            },
        })

        expect(style).toEqual({
            transform: "translateY(2) translateX(1px)",
        })
    })
})

interface BuildProps {
    style: ResolvedValues
    vars: ResolvedValues
    transform: ResolvedValues
    transformOrigin: TransformOrigin
    config: DOMVisualElementOptions & { transformTemplate?: any }
}

function build(
    latest: ResolvedValues,
    {
        style = {},
        vars = {},
        transform = {},
        transformOrigin = {},
        config = {},
    }: Partial<BuildProps> = {}
) {
    buildHTMLStyles(
        {
            style,
            vars,
            transform,
            transformOrigin,
        },
        latest,
        config.transformTemplate
    )
}
