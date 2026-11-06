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

    test("mixes rotate, rotateX, rotateY, rotateZ, skewX and skewY (#2611)", () => {
        const output = {}

        mixValues(
            output,
            { rotate: 10, rotateX: 20, rotateY: 30, rotateZ: 40, skewX: 50 },
            { rotateZ: 80, skewY: 10 },
            0.5,
            false,
            false
        )

        expect(output).toEqual({
            rotate: 5,
            rotateX: 10,
            rotateY: 15,
            rotateZ: 60,
            skewX: 25,
            skewY: 5,
        })
    })

    test("doesn't write untouched transforms", () => {
        const output = {}
        mixValues(output, {}, {}, 0.5, false, false)
        expect(output).toEqual({})
    })
    test("an interrupted crossfade fades the new lead in from where it was shown", () => {
        const output: Record<string, number> = {}

        /**
         * The previous lead was fading in at 0.4, while this node, its
         * follower, was fading out at 0.7.
         */
        mixValues(
            output,
            { opacity: 0.4, opacityExit: 0.7 },
            {},
            0,
            true,
            false
        )
        expect(output.opacity).toBe(0.7)
        expect(output.opacityExit).toBe(0.4)

        mixValues(
            output,
            { opacity: 0.4, opacityExit: 0.7 },
            {},
            1,
            true,
            false
        )
        expect(output.opacity).toBe(1)
        expect(output.opacityExit).toBe(0)
    })

    test("a crossfade fades the lead in from 0 when the follower wasn't fading", () => {
        const output: Record<string, number> = {}
        mixValues(output, { opacity: 1 }, {}, 0, true, false)
        expect(output.opacity).toBe(0)
    })
})
