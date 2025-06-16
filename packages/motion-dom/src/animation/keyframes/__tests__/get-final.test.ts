import { getFinalKeyframe } from "../get-final"

describe("getFinalKeyframe", () => {
    test("returns final keyframe", () => {
        expect(getFinalKeyframe([0, 1], {})).toEqual(1)
        expect(getFinalKeyframe([0, 1], { repeat: 1 })).toEqual(1)
        expect(getFinalKeyframe([0, 1], { repeat: 2 })).toEqual(1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 1, repeatType: "loop" })
        ).toEqual(1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 2, repeatType: "loop" })
        ).toEqual(1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 2, repeatType: "loop" }, -1)
        ).toEqual(-1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 3, repeatType: "loop" }, -1)
        ).toEqual(-1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 1, repeatType: "reverse" })
        ).toEqual(0)
        expect(
            getFinalKeyframe([0, 1], { repeat: 2, repeatType: "reverse" })
        ).toEqual(1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 2, repeatType: "reverse" }, -1)
        ).toEqual(-1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 3, repeatType: "reverse" }, -1)
        ).toEqual(0)
        expect(
            getFinalKeyframe([0, 1], { repeat: 1, repeatType: "mirror" })
        ).toEqual(0)
        expect(
            getFinalKeyframe([0, 1], { repeat: 2, repeatType: "mirror" })
        ).toEqual(1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 2, repeatType: "mirror" }, -1)
        ).toEqual(-1)
        expect(
            getFinalKeyframe([0, 1], { repeat: 3, repeatType: "mirror" }, -1)
        ).toEqual(0)
    })
})
