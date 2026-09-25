import { ScrollOffset } from "../../offsets/presets"
import { offsetToViewTimelineRange } from "../offset-to-range"

const entry = { rangeStart: "entry-crossing 0%", rangeEnd: "entry-crossing 100%" }
const exit = { rangeStart: "exit-crossing 0%", rangeEnd: "exit-crossing 100%" }

describe("offsetToViewTimelineRange", () => {
    it("maps Enter to entry-crossing", () => {
        expect(offsetToViewTimelineRange(ScrollOffset.Enter)).toEqual(entry)
        expect(offsetToViewTimelineRange(["start end", "end end"])).toEqual(
            entry
        )
    })

    it("maps Exit to exit-crossing", () => {
        expect(offsetToViewTimelineRange(ScrollOffset.Exit)).toEqual(exit)
        expect(offsetToViewTimelineRange(["start start", "end start"])).toEqual(
            exit
        )
        expect(offsetToViewTimelineRange(["start", "end start"])).toEqual(exit)
    })

    it("maps full cover to the ViewTimeline's default range", () => {
        expect(offsetToViewTimelineRange(["start end", "end start"])).toEqual(
            {}
        )
        expect(
            offsetToViewTimelineRange([
                [0, 1],
                [1, 0],
            ])
        ).toEqual({})
    })

    it("maps partial ranges across the container edges", () => {
        expect(
            offsetToViewTimelineRange(["center end", "center start"])
        ).toEqual({
            rangeStart: "entry-crossing 50%",
            rangeEnd: "exit-crossing 50%",
        })
        expect(
            offsetToViewTimelineRange([
                [0.25, 1],
                [0.75, 0],
            ])
        ).toEqual({
            rangeStart: "entry-crossing 25%",
            rangeEnd: "exit-crossing 75%",
        })
        expect(offsetToViewTimelineRange(["start end", "start start"])).toEqual(
            {
                rangeStart: "entry-crossing 0%",
                rangeEnd: "exit-crossing 0%",
            }
        )
    })

    /**
     * These run backwards for some (or all) target and container sizes,
     * which a ViewTimeline range can't express.
     */
    it("doesn't map offsets whose direction depends on size", () => {
        expect(offsetToViewTimelineRange(undefined)).toBeUndefined()
        expect(offsetToViewTimelineRange(ScrollOffset.All)).toBeUndefined()
        expect(offsetToViewTimelineRange(ScrollOffset.Any)).toBeUndefined()
        expect(
            offsetToViewTimelineRange(["start start", "end end"])
        ).toBeUndefined()
        expect(
            offsetToViewTimelineRange(["end end", "start start"])
        ).toBeUndefined()
        expect(offsetToViewTimelineRange([0, 1])).toBeUndefined()
        expect(
            offsetToViewTimelineRange(["end start", "start start"])
        ).toBeUndefined()
    })

    it("doesn't map container edges other than start and end", () => {
        expect(
            offsetToViewTimelineRange(["start center", "end start"])
        ).toBeUndefined()
        expect(
            offsetToViewTimelineRange([
                [0.5, 0],
                [1, 0.5],
            ])
        ).toBeUndefined()
    })

    it("doesn't map absolute lengths", () => {
        expect(
            offsetToViewTimelineRange(["100px end", "end start"])
        ).toBeUndefined()
        expect(
            offsetToViewTimelineRange(["start end", "end 50vh"])
        ).toBeUndefined()
    })

    it("doesn't map anything but two offsets", () => {
        expect(offsetToViewTimelineRange([[0, 0]])).toBeUndefined()
        expect(
            offsetToViewTimelineRange(["start end", "center center", "end start"])
        ).toBeUndefined()
    })
})
