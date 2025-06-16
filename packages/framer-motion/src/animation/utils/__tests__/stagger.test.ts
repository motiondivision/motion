import { easingDefinitionToFunction } from "motion-utils"
import { getOriginIndex, stagger } from "../stagger"

describe("stagger", () => {
    test("Creates a stagger function", () => {
        expect(stagger(0.1)(0, 10)).toEqual(0)
        expect(stagger(0.1)(2, 10)).toEqual(0.2)
    })

    test("Accepts startDelay", () => {
        expect(stagger(0.1, { startDelay: 0.2 })(0, 10)).toEqual(0.2)
        expect(stagger(0.1, { startDelay: 0.2 })(2, 10)).toEqual(0.4)
    })

    test("Accepts from", () => {
        expect(stagger(0.1, { from: 2 })(0, 10)).toEqual(0.2)
        expect(stagger(0.1, { from: "first" })(2, 10)).toEqual(0.2)
        expect(stagger(0.1, { from: "last" })(9, 10)).toEqual(0)
        expect(stagger(0.1, { from: "last" })(5, 10)).toEqual(0.4)
        expect(stagger(0.1, { from: "center" })(2, 10)).toEqual(0.25)
    })

    test("Accepts easing", () => {
        expect(stagger(0.1, { ease: "linear" })(5, 10)).toEqual(0.5)

        const expectedEaseIn = easingDefinitionToFunction("easeIn")(0.5)
        expect(stagger(0.1, { ease: "easeIn" })(5, 10)).toEqual(expectedEaseIn)

        const expectedEaseOut = easingDefinitionToFunction("easeOut")(0.5)
        expect(stagger(0.1, { ease: "easeOut" })(5, 10)).toEqual(
            expectedEaseOut
        )

        expect(stagger(0.1, { ease: (v: number) => v / 2 })(4, 10)).toEqual(0.2)
    })
})

describe("getOriginIndex", () => {
    test("Returns correct index", () => {
        expect(getOriginIndex("first", 9)).toEqual(0)
        expect(getOriginIndex("last", 9)).toEqual(8)
        expect(getOriginIndex("center", 9)).toEqual(4)
        expect(getOriginIndex("center", 10)).toEqual(4.5)
    })
})
