import { reverseEasing } from "../reverse"
import { easeOut } from "../../ease"

describe("reverseEasing", () => {
    test("correctly reverses an easing curve", () => {
        expect(reverseEasing(easeOut)(0.25)).toEqual(1 - easeOut(0.75))
    })
})
