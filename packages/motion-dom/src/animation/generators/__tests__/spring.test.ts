import { animateSync } from "../../__tests__/utils"
import { ValueAnimationOptions } from "../../types"
import { spring } from "../spring"
import { calcGeneratorDuration } from "../utils/calc-duration"

describe("spring", () => {
    test("Runs animations with default values ", () => {
        expect(animateSync(spring({ keyframes: [0, 1] }), 200)).toEqual([
            0, 1, 1, 1, 1, 1, 1, 1,
        ])
    })

    test("Underdamped spring", () => {
        expect(
            animateSync(
                spring({
                    keyframes: [100, 1000],
                    stiffness: 300,
                    restSpeed: 10,
                    restDelta: 0.5,
                }),
                200
            )
        ).toEqual([100, 1343, 873, 1046, 984, 1005, 998, 1001, 1000])
    })

    test("Velocity passed to underdamped spring", () => {
        const settings: ValueAnimationOptions<number> = {
            keyframes: [100, 1000],
            stiffness: 300,
            restSpeed: 10,
            restDelta: 0.5,
        }

        const noVelocity = animateSync(spring(settings), 200)
        const velocity = animateSync(
            spring({ ...settings, velocity: 1000 }),
            200
        )

        expect(noVelocity).not.toEqual(velocity)
    })

    test("Critically damped spring", () => {
        expect(
            animateSync(
                spring({
                    keyframes: [100, 1000],
                    stiffness: 100,
                    damping: 20,
                    restSpeed: 10,
                    restDelta: 0.5,
                }),
                200
            )
        ).toEqual([100, 635, 918, 984, 997, 1000])
    })

    test("Velocity passed to critically spring", () => {
        const settings = {
            keyframes: [100, 1000],
            stiffness: 100,
            damping: 20,
            restSpeed: 10,
            restDelta: 0.5,
        }

        const noVelocity = animateSync(spring(settings), 200)
        const velocity = animateSync(
            spring({ ...settings, velocity: 1000 }),
            200
        )

        expect(noVelocity).not.toEqual(velocity)
    })

    test("Overdamped spring", () => {
        expect(
            animateSync(
                spring({
                    keyframes: [100, 1000],
                    stiffness: 300,
                    damping: 100,
                    restSpeed: 10,
                    restDelta: 0.5,
                }),
                200
            )
        ).toEqual([
            100, 499, 731, 855, 922, 958, 977, 988, 993, 996, 998, 999, 999,
            1000,
        ])
    })
    test("Overdamped spring with very high stiffness/damping", () => {
        expect(
            animateSync(
                spring({
                    keyframes: [100, 1000],
                    stiffness: 1000000,
                    damping: 10000000,
                    restDelta: 1,
                    restSpeed: 10,
                }),
                200
            )
        ).toEqual([100, 1000])
    })

    test("Velocity passed to overdamped spring", () => {
        const settings = {
            keyframes: [100, 1000],
            stiffness: 300,
            damping: 100,
            restSpeed: 10,
            restDelta: 0.5,
        }

        const noVelocity = animateSync(spring(settings), 200)
        const velocity = animateSync(
            spring({ ...settings, velocity: 1000 }),
            200
        )

        expect(noVelocity).not.toEqual(velocity)
    })

    test("Spring defined with bounce and duration is same as just bounce", () => {
        const settings = {
            keyframes: [100, 1000],
            bounce: 0.1,
        }

        const withoutDuration = animateSync(spring(settings), 200)
        const withDuration = animateSync(
            spring({ ...settings, duration: 800 }),
            200
        )

        expect(withoutDuration).toEqual(withDuration)
        // Check duration order of magnitude is correct
        expect(withoutDuration.length).toBeGreaterThan(4)
    })

    test("Time-defined spring ignores velocity", () => {
        const settings = {
            keyframes: [500, 10],
            bounce: 0.2,
            duration: 1000,
        }
        const withVelocity = spring({ ...settings, velocity: 1000 })
        const withoutVelocity = spring(settings)

        // Time-defined springs ignore velocity to prevent wild oscillation
        // from interrupted animations
        expect(withVelocity.next(0).value).toBe(withoutVelocity.next(0).value)
        expect(withVelocity.next(100).value).toBe(
            withoutVelocity.next(100).value
        )
    })

    test("Time-defined spring with velocity does not wildly oscillate", () => {
        /**
         * Time-defined springs (duration/bounce) must ignore inherited
         * velocity. When an animation is interrupted, the motionValue
         * carries velocity from the in-progress animation. If this leaks
         * into findSpring(), it changes the computed spring parameters
         * and causes massive oscillation on small-range animations.
         */
        const settings = {
            keyframes: [0, 100],
            bounce: 0.2,
            duration: 400,
        }

        const noVelocity = spring(settings)
        const withVelocity = spring({ ...settings, velocity: 5000 })

        let maxNoVelocity = 0
        let maxWithVelocity = 0

        for (let t = 0; t <= 400; t += 5) {
            const noVel = noVelocity.next(t).value
            const withVel = withVelocity.next(t).value

            if (noVel > maxNoVelocity) maxNoVelocity = noVel
            if (withVel > maxWithVelocity) maxWithVelocity = withVel
        }

        // Both should have identical mild overshoot (velocity is ignored)
        expect(maxNoVelocity - 100).toBeLessThan(5)
        expect(maxWithVelocity - 100).toBeLessThan(5)
    })

    test("Spring animating back to same number returns correct duration", () => {
        const duration = calcGeneratorDuration(
            spring({
                keyframes: [1, 1],
                velocity: 5,
                stiffness: 200,
                damping: 15,
            })
        )

        expect(duration).toBe(600)
    })
})

describe("visualDuration", () => {
    test("returns correct duration", () => {
        const generator = spring({ keyframes: [0, 1], visualDuration: 0.5 })

        expect(calcGeneratorDuration(generator)).toBe(1100)
    })

    test("correctly resolves shorthand", () => {
        expect(
            spring({
                keyframes: [0, 1],
                visualDuration: 0.5,
                bounce: 0.25,
            }).toString()
        ).toEqual(spring(0.5, 0.25).toString())
    })
})

describe("toString", () => {
    test("returns correct string", () => {
        const physicsSpring = spring({
            keyframes: [0, 1],
            stiffness: 100,
            damping: 10,
            mass: 1,
        })

        expect(physicsSpring.toString()).toBe(
            "1100ms linear(0, 0.0419, 0.1493, 0.2963, 0.4608, 0.625, 0.7759, 0.905, 1.0077, 1.0827, 1.1314, 1.1567, 1.1629, 1.1545, 1.1359, 1.1114, 1.0844, 1.0578, 1.0336, 1.0131, 0.9969, 0.9853, 0.9779, 0.9742, 0.9735, 0.9751, 0.9783, 0.9824, 0.9868, 0.9911, 0.995, 0.9982, 1.0008, 1.0026, 1.0037, 1.0043, 1)"
        )

        const durationSpring = spring({
            keyframes: [0, 1],
            duration: 800,
            bounce: 0.25,
        })

        expect(durationSpring.toString()).toBe(
            "800ms linear(0, 0.0542, 0.1797, 0.3344, 0.4905, 0.6321, 0.7511, 0.8451, 0.9152, 0.9644, 0.9967, 1.0157, 1.0253, 1.0283, 1.0273, 1.024, 1.0196, 1.0152, 1.0111, 1.0076, 1.0048, 1.0027, 1.0012, 1.0002, 0.9996, 0.9993, 1)"
        )

        const visualDurationSpring = spring({
            keyframes: [0, 1],
            visualDuration: 0.5,
            bounce: 0.25,
        })

        expect(visualDurationSpring.toString()).toBe(
            "850ms linear(0, 0.046, 0.1551, 0.2934, 0.4378, 0.5737, 0.6927, 0.7915, 0.8694, 0.928, 0.9699, 0.998, 1.0153, 1.0245, 1.0281, 1.0279, 1.0254, 1.0217, 1.0176, 1.0136, 1.01, 1.007, 1.0045, 1.0027, 1.0013, 1.0003, 0.9997, 1)"
        )
    })
})
