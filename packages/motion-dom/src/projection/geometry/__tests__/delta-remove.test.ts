import { removeBoxTransforms } from "../delta-remove"

describe("removeBoxTransforms", () => {
    test("treats 'none' as the default value", () => {
        const box = {
            x: { min: 100, max: 300 },
            y: { min: 0, max: 200 },
        }
        removeBoxTransforms(box, {
            x: "none",
            y: "none",
            scale: "none",
            scaleX: 2,
            scaleY: "none",
        })
        expect(box.x).toEqual({ min: 150, max: 250 })
        expect(box.y).toEqual({ min: 0, max: 200 })
    })
})
