import { mirrorEasing } from "../mirror"

const testEase = (p: number) => p * p

describe("mirrorEasing", () => {
    test("correctly mirrors an easing curve", () => {
        expect(mirrorEasing(testEase)(0.25)).toEqual(0.125)
        expect(mirrorEasing(testEase)(0.75)).toEqual(0.875)
    })
})
