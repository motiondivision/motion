import { has2DTranslate, hasScale, hasTransform } from "../has-transform"

describe("hasTransform", () => {
    test("treats 'none' as the default value", () => {
        const none = {
            x: "none",
            y: "none",
            z: "none",
            scale: "none",
            scaleX: "none",
            scaleY: "none",
            rotate: "none",
            rotateX: "none",
            rotateY: "none",
            skewX: "none",
            skewY: "none",
        }
        expect(hasTransform(none)).toBeFalsy()
        expect(hasScale(none)).toBe(false)
        expect(has2DTranslate(none)).toBeFalsy()

        expect(hasTransform({ ...none, rotate: 45 })).toBeTruthy()
        expect(hasScale({ ...none, scaleX: 2 })).toBe(true)
        expect(has2DTranslate({ ...none, y: 10 })).toBeTruthy()
    })
})
