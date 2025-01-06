import { calcGeneratorDuration, ValueAnimationOptions } from "motion-dom"
import { animateSync } from "../../animators/__tests__/utils"
import { spring } from "../spring"

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

    test("Spring defined as bounce and duration is resolved with correct velocity", () => {
        const settings = {
            keyframes: [500, 10],
            bounce: 0.2,
            duration: 1000,
        }
        const resolvedSpring = spring({ ...settings, velocity: 1000 })

        expect(resolvedSpring.next(0).value).toBe(500)
        expect(Math.floor(resolvedSpring.next(100).value)).toBe(420)
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
            "1100ms linear(0, 0.04194850778210579, 0.14932950126380995, 0.2963437796500159, 0.46082096429364294, 0.6250338421482647, 0.7759436260445078, 0.9050063854127511, 1.0076716369056948, 1.08269417017245, 1.1313632152119162, 1.1567322462156397, 1.162910735616452, 1.1544580838082632, 1.135901202975243, 1.1113817077446062, 1.0844267521809636, 1.0578292518205104, 1.0336182525290103, 1.0130980771054825, 0.9969350165150217, 0.9852721277431441, 0.9778555743946217, 0.9741593857917341, 0.9734990920012613, 0.9751280926296118, 0.9783136126561669, 0.9823915565398572, 0.9868014376321201, 0.9911038405316862, 0.9949836212722639, 0.9982423449158154, 1.000783397865038, 1.0025928919562468, 1.0037189926384433, 1.0042517362931451, 1)"
        )

        const durationSpring = spring({
            keyframes: [0, 1],
            duration: 800,
            bounce: 0.25,
        })

        expect(durationSpring.toString()).toBe(
            "800ms linear(0, 0.054177405016021196, 0.17972848064273883, 0.3343501584874773, 0.4905262924508025, 0.6320839235932971, 0.7510610411804188, 0.8450670152703789, 0.9151922015692906, 0.9644450242720048, 0.9966514779382684, 1.0157332114866835, 1.025277758976255, 1.0283215605911404, 1.02727842591652, 1.023959776584356, 1.0196463059772216, 1.015182448481659, 1.0110747373077722, 1.0075826495638103, 1.0047960480865514, 1.0026971231302306, 1.001207153877063, 1.0002197848978414, 0.999623144749416, 0.9993132705317652, 1)"
        )

        const visualDurationSpring = spring({
            keyframes: [0, 1],
            visualDuration: 0.5,
            bounce: 0.25,
        })

        expect(visualDurationSpring.toString()).toBe(
            "850ms linear(0, 0.04598659284844886, 0.1550978525021358, 0.293435416964683, 0.4378422541508299, 0.5736798672774968, 0.692748833850205, 0.7914734576133282, 0.8694017506567162, 0.9280251869268804, 0.9698937637734765, 0.9979863588386336, 1.0152902865362166, 1.024544165390638, 1.028102233067043, 1.027884258234232, 1.0253819114839424, 1.0216990275613216, 1.0176091156745415, 1.0136185020587367, 1.0100275420648654, 1.0069854535323504, 1.0045366006169996, 1.0026576306325918, 1.0012858767919226, 1.0003400208170226, 0.999734279313089, 1)"
        )
    })
})
