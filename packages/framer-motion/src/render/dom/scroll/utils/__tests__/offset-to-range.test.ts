import { offsetToViewTimelineRange } from "../offset-to-range"

describe("offsetToViewTimelineRange", () => {
    it("maps undefined (default) to contain", () => {
        expect(offsetToViewTimelineRange(undefined)).toEqual({
            rangeStart: "contain 0%",
            rangeEnd: "contain 100%",
        })
    })

    it("maps Enter preset to entry range", () => {
        expect(
            offsetToViewTimelineRange([
                [0, 1],
                [1, 1],
            ])
        ).toEqual({
            rangeStart: "entry 0%",
            rangeEnd: "entry 100%",
        })
    })

    it("maps Exit preset to exit range", () => {
        expect(
            offsetToViewTimelineRange([
                [0, 0],
                [1, 0],
            ])
        ).toEqual({
            rangeStart: "exit 0%",
            rangeEnd: "exit 100%",
        })
    })

    it("maps Any preset to cover range", () => {
        expect(
            offsetToViewTimelineRange([
                [1, 0],
                [0, 1],
            ])
        ).toEqual({
            rangeStart: "cover 0%",
            rangeEnd: "cover 100%",
        })
    })

    it("maps All preset to contain range", () => {
        expect(
            offsetToViewTimelineRange([
                [0, 0],
                [1, 1],
            ])
        ).toEqual({
            rangeStart: "contain 0%",
            rangeEnd: "contain 100%",
        })
    })

    it("returns undefined for string offsets", () => {
        expect(
            offsetToViewTimelineRange(["start end", "end start"])
        ).toBeUndefined()
    })

    it("returns undefined for non-preset ProgressIntersection arrays", () => {
        expect(
            offsetToViewTimelineRange([
                [0.5, 0],
                [1, 0.5],
            ])
        ).toBeUndefined()
    })

    it("returns undefined for single-item offset", () => {
        expect(offsetToViewTimelineRange([[0, 0]])).toBeUndefined()
    })
})
