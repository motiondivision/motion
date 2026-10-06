import { parseIndividualTransform } from "../../dom/parse-transform"

describe("parseIndividualTransform", () => {
    it("reads translate components", () => {
        const computed = {
            translate: "10px 20px",
            scale: "none",
            rotate: "none",
        }
        expect(parseIndividualTransform(computed as any, "x")).toBe(10)
        expect(parseIndividualTransform(computed as any, "y")).toBe(20)
        expect(parseIndividualTransform(computed as any, "z")).toBe(0)
        expect(
            parseIndividualTransform(
                { ...computed, translate: "10px" } as any,
                "y"
            )
        ).toBe(0)
    })

    it("reads scale components", () => {
        expect(parseIndividualTransform({ scale: "1.5" } as any, "scale")).toBe(
            1.5
        )
        expect(
            parseIndividualTransform({ scale: "2 3" } as any, "scaleX")
        ).toBe(2)
        expect(
            parseIndividualTransform({ scale: "2 3" } as any, "scaleY")
        ).toBe(3)
        expect(
            parseIndividualTransform({ scale: "none" } as any, "scale")
        ).toBeUndefined()
    })

    it("reads rotate", () => {
        expect(
            parseIndividualTransform({ rotate: "45deg" } as any, "rotate")
        ).toBe(45)
        expect(
            parseIndividualTransform({ rotate: "none" } as any, "rotateZ")
        ).toBeUndefined()
        expect(
            parseIndividualTransform({ rotate: "x 45deg" } as any, "rotate")
        ).toBe(0)
    })

    it("returns undefined for keys not covered", () => {
        expect(
            parseIndividualTransform({ translate: "10px" } as any, "skewX")
        ).toBeUndefined()
        expect(parseIndividualTransform({} as any, "x")).toBeUndefined()
    })
})
