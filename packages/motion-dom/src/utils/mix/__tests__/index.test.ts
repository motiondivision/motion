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

    test("mixes single unit values like complex values", () => {
        expect(mix("0%", "50%")(0.5)).toBe("25%")
        expect(mix("0px", "1px")(1 / 3)).toBe("0.33333px")
        expect(mix("-10px", "10px")(0.25)).toBe("-5px")
        expect(mix(".5em", "1.5em")(0.5)).toBe("1em")
        expect(mix("10deg", "20deg")(0)).toBe("10deg")
        expect(mix("10deg", "20deg")(1)).toBe("20deg")
        expect(mix("10", "20")(0.5)).toBe("15")
    })

    test("mixes mismatched or exotic units via the complex mixer", () => {
        expect(mix("0px", "50%")(0.5)).toBe("25%")
        // Exponents aren't a unit: same (odd) result as the complex mixer
        expect(mix("1e2px", "3e2px")(0.5)).toBe("2e2px")
        expect(mix("10px 0px", "20px 10px")(0.5)).toBe("15px 5px")
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
