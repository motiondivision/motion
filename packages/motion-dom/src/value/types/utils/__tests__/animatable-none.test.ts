import { getAnimatableNone } from "../animatable-none"

describe("getAnimatableNone", () => {
    test("returns the none for each key and value, in any order", () => {
        expect(getAnimatableNone("borderRadius", "50%")).toBe("0%")
        expect(getAnimatableNone("borderRadius", "50%")).toBe("0%")
        expect(getAnimatableNone("borderRadius", "10px")).toBe("0px")
        expect(getAnimatableNone("backgroundColor", "#ff0088")).toBe(
            "rgba(255, 0, 136, 0)"
        )
        expect(getAnimatableNone("borderRadius", "10px")).toBe("0px")
        /**
         * The same value has a different none for a different key.
         */
        expect(getAnimatableNone("filter", "brightness(0.5)")).toBe(
            "brightness(1)"
        )
        expect(getAnimatableNone("boxShadow", "brightness(0.5)")).toBe(
            "brightness(0)"
        )
        expect(getAnimatableNone("filter", "brightness(0.5)")).toBe(
            "brightness(1)"
        )
    })
})
