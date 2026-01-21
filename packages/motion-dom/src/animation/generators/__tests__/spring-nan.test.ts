import { spring } from "../spring"

/**
 * Tests for spring animation NaN prevention (issue #2791)
 *
 * Root cause: When stiffness or mass is 0, the spring calculations produce NaN:
 *   - dampingRatio = damping / (2 * sqrt(0 * mass)) = Infinity
 *   - dampedAngularFreq = 0 * sqrt(Infinity² - 1) = 0 * Infinity = NaN
 *
 * Fix: The spring generator now falls back to default stiffness/mass values
 * when they are 0 or falsy, preventing NaN at the source without adding
 * per-frame overhead in the rendering hot path.
 */
describe("spring NaN prevention (#2791)", () => {
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
