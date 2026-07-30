import { buildStyles } from "../style/build"
import { buildSVGProps } from "../svg/build"

describe("buildStyles", () => {
    test("Builds basic styles", () => {
        expect(buildStyles({ width: 100 })).toEqual({ width: "100px" })
    })

    test("Builds fontSize with px unit", () => {
        expect(buildStyles({ fontSize: 16 })).toEqual({ fontSize: "16px" })
    })

    test("Builds vars", () => {
        expect(buildStyles({ "--width": 100 })).toEqual({ "--width": 100 })
    })

    test("Builds transform with default value types", () => {
        expect(
            buildStyles({ x: 1, y: 0, rotateX: 90, transformPerspective: 200 })
        ).toEqual({
            transform: "perspective(200px) translateX(1px) rotateX(90deg)",
        })
    })

    test("Builds perspective into the CSS perspective style", () => {
        expect(
            buildStyles({ perspective: 100, transform: "translateX(100px)" })
        ).toEqual({
            perspective: "100px",
            transform: "translateX(100px)",
        })
    })

    test("Builds transform with defined value types", () => {
        expect(buildStyles({ x: "1vw", y: "2%", rotateX: "90turn" })).toEqual({
            transform: "translateX(1vw) translateY(2%) rotateX(90turn)",
        })
    })

    test("Builds transform none if all transforms are default", () => {
        expect(buildStyles({ x: 0, y: 0, scale: 1 })).toEqual({
            transform: "none",
        })
    })

    test("Builds transformOrigin with correct default value types", () => {
        expect(
            buildStyles({ originX: 0.2, originY: "60%", originZ: 10 })
        ).toEqual({
            transformOrigin: "20% 60% 10px",
        })
    })

    test("Applies transformTemplate if provided", () => {
        expect(
            buildStyles({ x: 1 }, ({ x }: any, gen: string) =>
                `translateY(${parseFloat(x as string) * 2}) ${gen}`
            )
        ).toEqual({
            transform: "translateY(2) translateX(1px)",
        })
    })
})

describe("buildSVGProps", () => {
    it("correctly generates SVG path props", () => {
        const { attrs } = buildSVGProps(
            { pathLength: 0.5, pathSpacing: 0.25, pathOffset: 0.25 },
            false
        )

        // Uses unitless values to avoid Safari zoom bug
        expect(attrs.pathLength).toBe(1)
        expect(attrs.strokeDashoffset).toBe("-0.25")
        expect(attrs.strokeDasharray).toBe("0.5 0.25")
    })

    it("routes transforms to styles with a fill-box transformBox", () => {
        const { attrs, style } = buildSVGProps({ x: 100, cx: 5 }, false)

        expect(style.transform).toBe("translateX(100px)")
        expect(style.transformBox).toBe("fill-box")
        expect(style.transformOrigin).toBe("50% 50%")
        expect(attrs.cx).toBe(5)
        expect(attrs.transform).toBeUndefined()
    })

    it("renders attrX/attrY/attrScale as attributes", () => {
        const { attrs } = buildSVGProps(
            { attrX: 1, attrY: 2, attrScale: 3 },
            false
        )

        expect(attrs.x).toBe(1)
        expect(attrs.y).toBe(2)
        expect(attrs.scale).toBe(3)
    })

    it("treats svg tags as HTML, copying viewBox to attrs", () => {
        const { attrs, style } = buildSVGProps(
            { viewBox: "0 0 100 100", width: 50 },
            true
        )

        expect(attrs.viewBox).toBe("0 0 100 100")
        expect(style.width).toBe("50px")
    })
})
