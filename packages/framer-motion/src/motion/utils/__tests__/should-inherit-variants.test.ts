import { animationControls } from "../../../animation/hooks/animation-controls"
import { checkShouldInheritVariant } from "../should-inherit-variant"

describe("checkShouldInheritVariant", () => {
    test("Detects when a component should inherit variants", () => {
        expect(checkShouldInheritVariant({ animate: { x: 0 } })).toBe(false)
        expect(checkShouldInheritVariant({ variants: {} })).toBe(true)
        expect(
            checkShouldInheritVariant({ variants: {}, inherit: false })
        ).toBe(false)
        expect(
            checkShouldInheritVariant({ variants: {}, inherit: false })
        ).toBe(false)
        expect(
            checkShouldInheritVariant({ variants: {}, animate: "variant" })
        ).toBe(false)
        expect(
            checkShouldInheritVariant({
                animate: animationControls() as any,
                variants: {},
            })
        ).toBe(false)
        expect(
            checkShouldInheritVariant({
                animate: animationControls() as any,
                variants: {},
                inherit: true,
            })
        ).toBe(true)
    })
})
