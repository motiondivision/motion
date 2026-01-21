import { spring } from "../spring"

/**
 * Tests to isolate NaN conditions in spring animations (issue #2791)
 *
 * Root cause analysis:
 *
 * 1. Spring generator edge case (stiffness = 0):
 *    - undampedAngularFreq = sqrt(0 / mass) = 0
 *    - dampingRatio = damping / (2 * sqrt(0 * mass)) = damping / 0 = Infinity
 *    - Since dampingRatio > 1, we enter overdamped case
 *    - dampedAngularFreq = 0 * sqrt(Infinity² - 1) = 0 * Infinity = NaN
 *
 * 2. Mixing edge case (delta = 0 with extreme progress):
 *    - When animating polygon points like "550,36" → "720,36"
 *    - The y-coordinate has delta = 0 (36 → 36)
 *    - mixNumber(36, 36, p) = 36 + (36-36) * p = 36 + 0 * p
 *    - If p = Infinity: 36 + 0 * Infinity = 36 + NaN = NaN
 *
 * The defensive fix in sanitize() catches NaN at the output stage,
 * preventing invalid values from being rendered to the DOM.
 */
describe("spring NaN conditions", () => {
    // Helper to check if any value in the animation sequence is NaN
    function hasNaN(generator: ReturnType<typeof spring>, steps = 20): boolean {
        for (let i = 0; i <= steps; i++) {
            const t = i * 50 // 50ms steps
            const { value } = generator.next(t)
            if (Number.isNaN(value)) {
                return true
            }
        }
        return false
    }

    it("should not produce NaN when animating same value to same value", () => {
        // This is common in polygon points where some coordinates don't change
        const generator = spring({
            keyframes: [100, 100], // same start and end
            stiffness: 100,
            damping: 10,
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with zero stiffness", () => {
        const generator = spring({
            keyframes: [0, 100],
            stiffness: 0,
            damping: 10,
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with very small stiffness", () => {
        const generator = spring({
            keyframes: [0, 100],
            stiffness: 0.0001,
            damping: 10,
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN near critical damping", () => {
        // dampingRatio = damping / (2 * sqrt(stiffness * mass))
        // For dampingRatio = 1: damping = 2 * sqrt(100 * 1) = 20
        const generator = spring({
            keyframes: [0, 100],
            stiffness: 100,
            damping: 19.9999, // Very close to critical damping
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with bounce=0 (maxDamping)", () => {
        const generator = spring({
            keyframes: [0, 100],
            bounce: 0, // This should produce dampingRatio close to 1
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with zero mass", () => {
        const generator = spring({
            keyframes: [0, 100],
            stiffness: 100,
            damping: 10,
            mass: 0,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with very large damping (overdamped)", () => {
        const generator = spring({
            keyframes: [0, 100],
            stiffness: 100,
            damping: 1000,
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with same value and zero velocity", () => {
        const generator = spring({
            keyframes: [50, 50],
            velocity: 0,
            stiffness: 100,
            damping: 10,
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })

    it("should not produce NaN with same value and non-zero velocity", () => {
        const generator = spring({
            keyframes: [50, 50],
            velocity: 1000,
            stiffness: 100,
            damping: 10,
            mass: 1,
        })
        expect(hasNaN(generator)).toBe(false)
    })
})
