import { copyBoxInto } from "../copy"
import { createBox } from "../models"

describe("copyBoxInto", () => {
    it("copies one box into an existing box", () => {
        const a = createBox()
        const b = {
            x: { min: 1, max: 2 },
            y: { min: 3, max: 4 },
        }

        copyBoxInto(a, b)

        expect(a).toEqual(b)
        expect(a).not.toBe(b)
    })
})
