import { convertBoundingBoxToBox } from "../conversion"

describe("convertBoundingBoxToBox", () => {
    it("Correctly converts a bounding box into a box", () => {
        expect(
            convertBoundingBoxToBox({ top: 1, right: 4, bottom: 3, left: 2 })
        ).toEqual({
            x: { min: 2, max: 4 },
            y: { min: 1, max: 3 },
        })
    })
})
