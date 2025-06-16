import { mix } from "../"

describe("mix", () => {
    test("Supports legacy immediate call syntax", () => {
        const output = mix(0, 2, 0.25)
        expect(output).toBe(0.5)
    })

    test("mixes numbers", () => {
        const mixer = mix(0, 2)
        expect(mixer(0.25)).toBe(0.5)
    })

    test("mixes deep array", () => {
        const mixer = mix(
            { a: [0, 1], b: { c: 0, d: "1px" } },
            { a: [2, 3], b: { c: 1, d: "2px" } }
        )

        expect(mixer(0.5)).toEqual({ a: [1, 2], b: { c: 0.5, d: "1.5px" } })
    })

    test("mixes deep array", () => {
        const mixer = mix(
            [[0, 1], { c: 0, d: "1px" }],
            [[2, 3], { c: 1, d: "2px" }]
        )

        expect(mixer(0.5)).toEqual([[1, 2], { c: 0.5, d: "1.5px" }])
    })

    test("mixes complex values", () => {
        expect(mix("var(--test) 0px", "var(--test) 20px")(0.5)).toBe(
            "var(--test) 10px"
        )
        expect(mix("var(--test-1) 10px", "var(--test-9) 60px")(0.5)).toBe(
            "var(--test-9) 35px"
        )
    })

    test("mixes binary visibility", () => {
        expect(mix("visible", "hidden")(0)).toBe("visible")
        expect(mix("visible", "hidden")(0.5)).toBe("visible")
        expect(mix("visible", "hidden")(1)).toBe("hidden")
        expect(mix("hidden", "visible")(0)).toBe("hidden")
        expect(mix("hidden", "visible")(0.5)).toBe("visible")
        expect(mix("hidden", "visible")(1)).toBe("visible")
        expect(mix("block", "none")(0)).toBe("block")
        expect(mix("block", "none")(0.5)).toBe("block")
        expect(mix("block", "none")(1)).toBe("none")
        expect(mix("none", "block")(0)).toBe("none")
        expect(mix("none", "block")(0.5)).toBe("block")
        expect(mix("none", "block")(1)).toBe("block")
    })
})
