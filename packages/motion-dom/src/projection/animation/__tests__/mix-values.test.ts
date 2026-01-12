import { mixValues } from "../mix-values"

describe("mixValues", () => {
    test("mixes borderRadius numbers", () => {
        const output = {}

        mixValues(
            output,
            { borderTopLeftRadius: 10 },
            { borderTopLeftRadius: 20 },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: 15 })
    })

    test("mixes borderRadius px", () => {
        const output = {}

        mixValues(
            output,
            { borderTopLeftRadius: "10px" },
            { borderTopLeftRadius: "20px" },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: 15 })
    })

    test("mixes borderRadius percentage", () => {
        const output = {}

        mixValues(
            output,
            { borderTopLeftRadius: "10%" },
            { borderTopLeftRadius: "20%" },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: "15%" })
    })

    test("mixes borderRadius percentage with 0", () => {
        const output = {}

        mixValues(
            output,
            { borderTopLeftRadius: 0 },
            { borderTopLeftRadius: "20%" },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: "10%" })

        mixValues(
            output,
            { borderTopLeftRadius: "20%" },
            { borderTopLeftRadius: 0 },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: "10%" })
    })

    test("doesn't mix % with px", () => {
        const output = {}

        mixValues(
            output,
            { borderTopLeftRadius: "10px" },
            { borderTopLeftRadius: "20%" },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: "20%" })

        mixValues(
            output,
            { borderTopLeftRadius: "20%" },
            { borderTopLeftRadius: "10px" },
            0.5,
            false,
            false
        )

        expect(output).toEqual({ borderTopLeftRadius: "10px" })
    })
})
