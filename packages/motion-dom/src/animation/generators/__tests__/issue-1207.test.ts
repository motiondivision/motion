import { spring } from "../spring"

/**
 * https://github.com/motiondivision/motion/issues/1207
 *
 * A slow overdamped spring should approach its target smoothly. Currently
 * the overdamped "non-physical limit" (dampedAngularFreq * t > 300) kicks
 * in at ~8.6s for these options and the spring snaps to its target.
 */
describe("issue #1207: slow overdamped spring", () => {
    test("does not snap to target part-way through", () => {
        const generator = spring({
            keyframes: [0, 1000],
            stiffness: 4,
            damping: 35,
            mass: 0.5,
            velocity: 0,
        })

        let prev = generator.next(0).value
        let maxStep = 0
        for (let t = 16; t <= 12000; t += 16) {
            const value = generator.next(t).value
            maxStep = Math.max(maxStep, value - prev)
            prev = value
        }

        // Peak per-frame movement of this spring is ~1px (initial fast phase)
        expect(maxStep).toBeLessThan(5)
        // Slow mode decays at ~0.115/s, so at 10s it's still ~2/3 of the way
        expect(generator.next(10000).value).toBeLessThan(800)
    })
})
