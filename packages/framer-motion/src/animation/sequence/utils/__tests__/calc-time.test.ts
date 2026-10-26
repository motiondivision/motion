import { calcNextTime } from "../calc-time"

describe("calcNextTime", () => {
    test("Correctly returns a new time based on the past arguments", () => {
        const labels = new Map()
        labels.set("foo", 2)

        // Absolute time
        expect(calcNextTime(1, 0.2, 100, labels)).toBe(0.2)
        expect(calcNextTime(2, 0.2, 100, labels)).toBe(0.2)

        // Label
        expect(calcNextTime(4, "foo", 100, labels)).toBe(2)
        expect(calcNextTime(4, "bar", 100, labels)).toBe(4)

        // Relative time
        expect(calcNextTime(5, "-1", 100, labels)).toBe(4)
        expect(calcNextTime(5, "+1", 100, labels)).toBe(6)
        expect(calcNextTime(5, "-7", 100, labels)).toBe(0)

        // Previous
        expect(calcNextTime(5, "<", 100, labels)).toBe(100)

        // Relative to previous
        expect(calcNextTime(5, "<1", 100, labels)).toBe(101)
        expect(calcNextTime(5, "<+1", 100, labels)).toBe(101)
        expect(calcNextTime(5, "<-1", 100, labels)).toBe(99)
        expect(calcNextTime(5, "<2.5", 100, labels)).toBe(102.5)
        expect(calcNextTime(5, "<+2.5", 100, labels)).toBe(102.5)
        expect(calcNextTime(5, "<-2.5", 100, labels)).toBe(97.5)
        expect(calcNextTime(5, "<-150", 100, labels)).toBe(0)
    })

    test("Offsets a label by a relative time", () => {
        const labels = new Map()
        labels.set("foo", 2)
        labels.set("intro-2", 4)

        expect(calcNextTime(5, "foo+1", 100, labels)).toBe(3)
        expect(calcNextTime(5, "foo+0.5", 100, labels)).toBe(2.5)
        expect(calcNextTime(5, "foo-1.5", 100, labels)).toBe(0.5)
        expect(calcNextTime(5, "foo-3", 100, labels)).toBe(0)

        // A label whose name ends like an offset
        expect(calcNextTime(5, "intro-2", 100, labels)).toBe(4)
        expect(calcNextTime(5, "intro-2+1", 100, labels)).toBe(5)

        // Unknown label
        expect(calcNextTime(5, "bar+1", 100, labels)).toBe(5)
    })

    test("Offsets by a percentage of the previous segment's duration", () => {
        const labels = new Map()

        // Previous segment ran from 3 to 5, so it lasted 2
        expect(calcNextTime(5, "<50%", 3, labels)).toBe(4)
        expect(calcNextTime(5, "<+50%", 3, labels)).toBe(4)
        expect(calcNextTime(5, "<-50%", 3, labels)).toBe(2)
        expect(calcNextTime(5, "<100%", 3, labels)).toBe(5)
        expect(calcNextTime(5, "-25%", 3, labels)).toBe(4.5)
        expect(calcNextTime(5, "+50%", 3, labels)).toBe(6)
        expect(calcNextTime(5, "+12.5%", 3, labels)).toBe(5.25)

        // Clamped to the start of the timeline
        expect(calcNextTime(5, "<-300%", 3, labels)).toBe(0)
        expect(calcNextTime(5, "-500%", 3, labels)).toBe(0)

        // No previous segment, so there's no duration to offset by
        expect(calcNextTime(0, "<50%", 0, labels)).toBe(0)
        expect(calcNextTime(0, "+50%", 0, labels)).toBe(0)
    })
})
