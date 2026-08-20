import { buildTransform } from "../build-transform"

describe("buildTransform", () => {
    it("appends a user transform after independent transforms", () => {
        expect(
            buildTransform(
                { scale: 2, transform: "rotate(90deg)" },
                {}
            )
        ).toBe("scale(2) rotate(90deg)")
    })

    it("renders a user transform without independent transforms", () => {
        expect(buildTransform({ transform: "rotate(90deg)" }, {})).toBe(
            "rotate(90deg)"
        )
    })

    it("treats a user transform of none as absent", () => {
        expect(buildTransform({ scale: 2, transform: "none" }, {})).toBe(
            "scale(2)"
        )
    })

    it("passes the composed transform to transformTemplate", () => {
        const transformTemplate = jest.fn(
            (_, generated) => `translateX(10px) ${generated}`
        )

        expect(
            buildTransform(
                { scale: 2, transform: "rotate(90deg)" },
                {},
                transformTemplate
            )
        ).toBe("translateX(10px) scale(2) rotate(90deg)")
        expect(transformTemplate).toHaveBeenCalledWith(
            { scale: 2 },
            "scale(2) rotate(90deg)"
        )
    })
})
