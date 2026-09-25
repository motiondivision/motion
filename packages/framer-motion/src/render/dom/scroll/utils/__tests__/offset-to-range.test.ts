import { ScrollOffset } from "../../offsets/presets"
import { offsetToViewTimelineRange } from "../offset-to-range"

const range = (points: string[], a: number, b: number, cover = false) => ({
    points,
    a,
    b,
    cover,
})

const entry = range(["entry-crossing 0%", "entry-crossing 100%"], 1, 0)
const exit = range(["exit-crossing 0%", "exit-crossing 100%"], 1, 0)
const all = range(["exit-crossing 0%", "entry-crossing 100%"], 1, -1)

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
        const cover = range(
            ["entry-crossing 0%", "exit-crossing 100%"],
            1,
            1,
            true
        )
        expect(offsetToViewTimelineRange(["start end", "end start"])).toEqual(
            cover
        )
        expect(
            offsetToViewTimelineRange([
                [0, 1],
                [1, 0],
            ])
        ).toEqual(cover)
    })

    it("maps Any to cover, run backwards", () => {
        const any = range(["exit-crossing 100%", "entry-crossing 0%"], -1, -1)
        expect(offsetToViewTimelineRange(ScrollOffset.Any)).toEqual(any)
        expect(offsetToViewTimelineRange(["end start", "start end"])).toEqual(
            any
        )
    })

    /**
     * a × target length + b × container length changes sign when the target
     * becomes longer than the container.
     */
    it("maps All and the default offset with a size-dependent direction", () => {
        expect(offsetToViewTimelineRange(undefined)).toEqual(all)
        expect(offsetToViewTimelineRange(ScrollOffset.All)).toEqual(all)
        expect(offsetToViewTimelineRange(["start start", "end end"])).toEqual(
            all
        )
        expect(offsetToViewTimelineRange([0, 1])).toEqual(all)
        expect(offsetToViewTimelineRange(["end end", "start start"])).toEqual(
            range(["entry-crossing 100%", "exit-crossing 0%"], -1, 1)
        )
    })

    it("maps partial ranges across the container edges", () => {
        expect(
            offsetToViewTimelineRange(["center end", "center start"])
        ).toEqual(range(["entry-crossing 50%", "exit-crossing 50%"], 0, 1))
        expect(
            offsetToViewTimelineRange([
                [0.25, 1],
                [0.75, 0],
            ])
        ).toEqual(range(["entry-crossing 25%", "exit-crossing 75%"], 0.5, 1))
        expect(offsetToViewTimelineRange(["center start", "end end"])).toEqual(
            range(["exit-crossing 50%", "entry-crossing 100%"], 0.5, -1)
        )
    })

    it("doesn't map identical points", () => {
        expect(
            offsetToViewTimelineRange(["start start", "start start"])
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
            offsetToViewTimelineRange([
                "start end",
                "center center",
                "end start",
            ])
        ).toBeUndefined()
    })
})
