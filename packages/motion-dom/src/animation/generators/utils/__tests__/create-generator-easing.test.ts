import { spring } from "../../spring"
import { createGeneratorEasing } from "../create-generator-easing"

describe("createGeneratorEasing", () => {
    test("scales velocity to the normalised range", () => {
        const options = { stiffness: 100, damping: 10, mass: 1 }

        // Moving from 100 towards 50 with a velocity of +100 units/s
        const { ease } = createGeneratorEasing(
            { ...options, keyframes: [100, 50], velocity: 100 } as any,
            100,
            spring
        )
        // Progress first goes negative: the value keeps moving away
        // from the target, as it does on the main thread.
        expect(ease(0.02)).toBeLessThan(0)

        // The same velocity towards a target in the other direction
        const { ease: forward } = createGeneratorEasing(
            { ...options, keyframes: [50, 100], velocity: 100 } as any,
            100,
            spring
        )
        expect(forward(0.02)).toBeGreaterThan(0)

        // Without velocity progress starts at 0 and heads to the target
        const { ease: still } = createGeneratorEasing(
            { ...options, keyframes: [100, 50] } as any,
            100,
            spring
        )
        expect(still(0)).toBe(0)
        expect(still(0.02)).toBeGreaterThan(0)
    })
})
