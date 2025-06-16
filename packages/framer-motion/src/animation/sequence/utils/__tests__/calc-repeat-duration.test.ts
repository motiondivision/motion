import { calculateRepeatDuration } from "../calc-repeat-duration"

describe("calculateRepeatDuration", () => {
    test("It correctly calculates the duration", () => {
        expect(calculateRepeatDuration(1, 0, 0)).toEqual(1)
        expect(calculateRepeatDuration(1, 1, 0)).toEqual(2)
        expect(calculateRepeatDuration(1, 2, 0)).toEqual(3)
    })
})
