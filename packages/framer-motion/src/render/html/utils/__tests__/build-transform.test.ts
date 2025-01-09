import "../../../../../jest.setup"
import { buildTransform } from "../build-transform"
import { transformProps } from "../keys-transform"

describe("transformProps.has", () => {
    it("Correctly identifies only transformPerspective as a transform prop", () => {
        expect(transformProps.has("perspective")).toBe(false)
        expect(transformProps.has("transformPerspective")).toBe(true)
    })
    it("Correctly identifies translate and alias to be true", () => {
        expect(transformProps.has("x")).toBe(true)
        expect(transformProps.has("translateX")).toBe(true)
    })
})

describe("buildTransform", () => {
    it("Outputs 'none' when all values are default", () => {
        expect(buildTransform({ x: 0 }, {})).toBe("none")
        expect(buildTransform({ x: "0px" }, {})).toBe("none")
        expect(buildTransform({ rotateX: 0 }, {})).toBe("none")
        expect(buildTransform({ rotateX: "0deg" }, {})).toBe("none")
        expect(
            buildTransform(
                {
                    x: 0,
                    y: 0,
                    scale: 1,
                    scaleX: 1,
                    scaleY: 1,
                    rotate: 0,
                    rotateX: 0,
                    rotateY: 0,
                    rotateZ: 0,
                    skewX: 0,
                    skewY: 0,
                },
                {}
            )
        ).toBe("none")
        expect(
            buildTransform(
                {
                    x: "0px",
                    y: "0px",
                    scale: 1,
                    scaleX: 1,
                    scaleY: 1,
                    rotate: "0deg",
                    rotateX: "0deg",
                    rotateY: "0deg",
                    rotateZ: "0deg",
                    skewX: 0,
                    skewY: 0,
                },
                {}
            )
        ).toBe("none")
    })

    it("Still outputs translateZ if z is explicitly assigned", () => {
        expect(buildTransform({ x: 0, z: "5px" }, {})).toBe("translateZ(5px)")
    })

    it("Correctly handles transformPerspective", () => {
        expect(
            buildTransform({ x: "100px", transformPerspective: "200px" }, {})
        ).toBe("perspective(200px) translateX(100px)")
    })

    it("Correctly handles transformTemplate if provided", () => {
        expect(
            buildTransform(
                { x: "5px" },
                {},
                ({ x }: { x: string }) => `translateX(${parseFloat(x) * 2}px)`
            )
        ).toBe("translateX(10px)")

        expect(
            buildTransform(
                { x: 0, y: 200 },
                {},
                ({ x }: { x: string }, generated) =>
                    `translateX(${parseFloat(x) + 10}px) ${generated}`
            )
        ).toBe("translateX(10px) translateY(200px)")
    })

    it("Outputs transform values in the correct order", () => {
        expect(
            buildTransform(
                {
                    scale: 2,
                    rotate: "90deg",
                    x: 1,
                    y: "10px",
                    rotateZ: "190deg",
                },
                {}
            )
        ).toBe(
            "translateX(1px) translateY(10px) scale(2) rotate(90deg) rotateZ(190deg)"
        )
    })
})
