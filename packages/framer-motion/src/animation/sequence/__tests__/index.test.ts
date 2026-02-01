import { motionValue, spring, stagger } from "motion-dom"
import { Easing } from "motion-utils"
import { createAnimationsFromSequence } from "../create"
import { AnimationSequence, SequenceOptions } from "../types"

/**
 * Helper to maintain backward compatibility with tests.
 * Extracts just the animationDefinitions map from the new return structure.
 */
function getAnimationDefinitions(
    sequence: AnimationSequence,
    options?: SequenceOptions,
    scope?: undefined,
    generators?: { spring: typeof spring }
) {
    const result = createAnimationsFromSequence(
        sequence,
        options,
        scope,
        generators
    )
    return result.animationDefinitions
}

describe("createAnimationsFromSequence", () => {
    const a = document.createElement("div")
    const b = document.createElement("div")
    const c = document.createElement("div")
    const value = motionValue(0)

    test("It creates a single animation", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { opacity: 1 },
                    { duration: 1, ease: [0, 1, 2, 3], times: [0, 1] },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 1,
            ease: [
                [0, 1, 2, 3],
                [0, 1, 2, 3],
            ],
            times: [0, 1],
        })
    })

    test("It orders grouped keyframes correctly", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }],
                [a, { x: [200, 300] }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100, 200, 300])
    })

    test("It creates a single animation with defaults", () => {
        const animations = getAnimationDefinitions(
            [[a, { opacity: 1 }, { duration: 1 }]],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })
    })

    test("It creates a single animation with defaults - 2", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { x: [100, 100, 200, 300] },
                    {
                        duration: 0.5,
                        times: [0, 0.5, 0.7, 1],
                        ease: "easeInOut",
                    },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )
        expect(animations.get(a)!.keyframes.x).toEqual([100, 100, 200, 300])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 0.5,
            ease: ["easeInOut", "easeInOut", "easeInOut", "easeInOut"],
            times: [0, 0.5, 0.7, 1],
        })
    })

    test("It assigns the correct easing to the correct keyframes", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 1 }, { duration: 1, ease: "circIn" }],
                [a, { x: 2, opacity: 0 }, { duration: 1, ease: "backInOut" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        const { keyframes, transition } = animations.get(a)!
        expect(keyframes.x).toEqual([null, 1, null, 2])
        expect(transition.x).toEqual({
            duration: 2,
            ease: ["circIn", "circIn", "backInOut", "backInOut"],
            times: [0, 0.5, 0.5, 1],
        })
        expect(keyframes.opacity).toEqual([null, null, 0])
        expect(transition.opacity).toEqual({
            duration: 2,
            ease: ["easeInOut", "backInOut", "backInOut"],
            times: [0, 0.5, 1],
        })
    })

    test("It sequences one animation after another", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { x: [100, 200, 300], opacity: 1 },
                    { duration: 0.5, ease: "easeInOut" },
                ],
                [b, { y: 500 }, { duration: 0.5 }],
                [a, { x: 400 }, { duration: 1 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([
            100,
            200,
            300,
            null,
            400,
        ])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeInOut", "easeInOut", "easeOut", "easeOut"],
            times: [0, 0.125, 0.25, 0.5, 1],
        })

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1, null])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeInOut"],
            times: [0, 0.25, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, null, 500, null])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.25, 0.5, 1],
        })
    })

    test("It accepts motion values", () => {
        const animations = getAnimationDefinitions(
            [[value, 100, { duration: 0.5 }]],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(value)!.keyframes.default).toEqual([null, 100])
        expect(animations.get(value)!.transition.default).toEqual({
            duration: 0.5,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })
    })

    test("It accepts motion values keyframes", () => {
        const animations = getAnimationDefinitions(
            [[value, [50, 100], { duration: 0.5 }]],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(value)!.keyframes.default).toEqual([50, 100])
        expect(animations.get(value)!.transition.default).toEqual({
            duration: 0.5,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })
    })

    test("It adds relative time to another animation", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 0.5, at: "+0.5" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100, null])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, null, 500])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.75, 1],
        })
    })

    test("It adds moves the playhead back to the previous animation", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 0.5, at: "<" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, 500, null])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })
    })

    test("It adds subtracts time to another animation", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 0.5, at: "-1" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, 500, null])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })
    })

    test("It sets another animation at a specific time", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 0.5, at: 1.5 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100, null])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, null, 500])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.75, 1],
        })
    })

    test("It sets labels from strings", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                "my label",
                [a, { opacity: 0 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 1, at: "my label" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100, null])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, null, 0])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, null, 500])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })
    })

    test("Can set label as first item in sequence", () => {
        const animations = getAnimationDefinitions(
            [
                "my label",
                [a, { opacity: 0 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 1, at: "my label" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 0])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, 500])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })
    })

    test("It sets annotated labels with absolute at times", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                { name: "my label", at: 0 },
                [a, { opacity: 0 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 1, at: "my label" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100, null])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, null, 0])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, 500, null])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })
    })

    test("It sets annotated labels with relative at times", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 100 }, { duration: 1 }],
                { name: "my label", at: "-1" },
                [a, { opacity: 0 }, { duration: 1 }],
                [b, { y: 500 }, { duration: 1, at: "my label" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 100, null])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, null, 0])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })

        expect(animations.get(b)!.keyframes.y).toEqual([null, 500, null])
        expect(animations.get(b)!.transition.y).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.5, 1],
        })
    })

    test("It advances time by the maximum defined in individual value options", () => {
        const animations = getAnimationDefinitions([
            [a, { x: 1, y: 1 }, { duration: 1, y: { duration: 2 } }],
            [b, { y: 1 }, { duration: 0.5 }],
        ])

        expect(animations.get(a)!.transition.x.duration).toBe(2.5)
        expect(animations.get(b)!.transition.y.times?.[1]).toBe(0.8)
    })

    test("It creates multiple animations for multiple targets", () => {
        const animations = getAnimationDefinitions([[[a, b, c], { x: 1 }]])

        expect(animations.get(a)).toBeTruthy()
        expect(animations.get(b)).toBeTruthy()
        expect(animations.get(c)).toBeTruthy()
    })

    test("It creates multiple animations, staggered", () => {
        const animations = getAnimationDefinitions([
            [[a, b, c], { x: 1 }, { delay: stagger(1), duration: 1 }],
            [a, { opacity: 1 }, { duration: 1 }],
        ])

        expect(animations.get(a)!.keyframes.x).toEqual([null, 1, null])
        expect(animations.get(a)!.transition.x).toEqual({
            duration: 4,
            ease: ["easeOut", "easeOut"],
            times: [0, 0.25, 1],
        })
        expect(animations.get(a)!.keyframes.opacity).toEqual([null, null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 4,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.75, 1],
        })

        expect(animations.get(b)!.keyframes.x).toEqual([null, null, 1, null])
        expect(animations.get(b)!.transition.x).toEqual({
            duration: 4,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.25, 0.5, 1],
        })

        expect(animations.get(c)!.keyframes.x).toEqual([null, null, 1, null])
        expect(animations.get(c)!.transition.x).toEqual({
            duration: 4,
            ease: ["easeInOut", "easeOut", "easeOut"],
            times: [0, 0.5, 0.75, 1],
        })
    })

    test("It scales the whole animation based on the provided duration", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { opacity: 1 },
                    { duration: 1, ease: ["easeOut"], times: [0, 1] },
                ],
            ],
            { duration: 2 }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })
    })

    test("It passes timeline options to children", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { opacity: 1 },
                    { duration: 1, ease: ["easeOut"], times: [0, 1] },
                ],
            ],
            {
                duration: 2,
                repeat: Infinity,
                delay: 1,
            }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            repeat: Infinity,
            delay: 1,
            ease: ["easeOut", "easeOut"],
            times: [0, 1],
        })
    })

    test("It passes default options to children", () => {
        const animations = getAnimationDefinitions(
            [[a, { opacity: 1 }, { times: [0, 1] }]],
            { defaultTransition: { duration: 2, ease: "easeInOut" } }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: ["easeInOut", "easeInOut"],
            times: [0, 1],
        })
    })

    test("It correctly passes easing cubic bezier array to children", () => {
        const animations = getAnimationDefinitions(
            [[a, { opacity: 1 }, { times: [0, 1] }]],
            { defaultTransition: { duration: 2, ease: [0, 1, 2, 3] } }
        )

        expect(animations.get(a)!.keyframes.opacity).toEqual([null, 1])
        expect(animations.get(a)!.transition.opacity).toEqual({
            duration: 2,
            ease: [
                [0, 1, 2, 3],
                [0, 1, 2, 3],
            ],
            times: [0, 1],
        })
    })

    test("Adds spring as duration-based easing when only one keyframe defined", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 200 }, { duration: 1 }],
                [a, { x: 0 }, { duration: 1, type: "spring", bounce: 0 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 200, null, 0])
        const { duration, ease, times } = animations.get(a)!.transition.x

        expect(duration).toEqual(2)
        expect((ease as Easing[])[0]).toEqual("easeOut")
        expect((ease as Easing[])[1]).toEqual("easeOut")
        expect(typeof (ease as Easing[])[2]).toEqual("function")
        expect(times).toEqual([0, 0.5, 0.5, 1])
    })

    test("Adds spring as duration-based easing when only one keyframe defined", () => {
        const animations = getAnimationDefinitions(
            [[a, { x: [0, 100] }, { type: "spring" }]],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([0, 100])
        const { duration, ease } = animations.get(a)!.transition.x

        expect(duration).toEqual(1.1)
        expect(typeof (ease as Easing[])[0]).toEqual("function")
    })

    test("Adds springs as duration-based simulation when two keyframes defined", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 200 }, { duration: 1, ease: "linear" }],
                [
                    a,
                    { x: [200, 0] },
                    { duration: 1, type: "spring", bounce: 0 },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 200, 200, 0])
        const { duration, ease, times } = animations.get(a)!.transition.x

        expect(duration).toEqual(2)
        expect((ease as Easing[])[0]).toEqual("linear")
        expect((ease as Easing[])[1]).toEqual("linear")
        expect(typeof (ease as Easing[])[2]).toEqual("function")
        expect(times).toEqual([0, 0.5, 0.5, 1])
    })

    test("It correctly adds type: spring to timeline with simulated spring", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 200 }, { duration: 1 }],
                [
                    a,
                    { x: [100, 0] },
                    { type: "spring", stiffness: 200, damping: 10 },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([null, 200, 100, 0])
        const { duration, ease, times } = animations.get(a)!.transition.x

        expect(duration).toEqual(2.2)
        expect((ease as Easing[])[0]).toEqual("easeOut")
        expect((ease as Easing[])[1]).toEqual("easeOut")
        expect(typeof (ease as Easing[])[2]).toEqual("function")
        expect(times).toEqual([0, 0.45454545454545453, 0.45454545454545453, 1])
    })

    test("Does not include type: spring in transition when spring is converted to easing via defaultTransition", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: 0 }, { duration: 0 }],
                [a, { x: 1.12 }],
                [a, { x: 0.98 }, { at: "<+0.15" }],
                [a, { x: 1 }, { at: "<+0.35" }],
            ],
            { defaultTransition: { type: "spring", stiffness: 72, damping: 10 } },
            undefined,
            { spring }
        )

        const { transition } = animations.get(a)!

        // The spring should be converted to easing functions, not kept as type: "spring"
        expect(transition.x.type).toBeUndefined()

        // Verify the easing functions are present
        expect(Array.isArray(transition.x.ease)).toBe(true)
        const easeArray = transition.x.ease as Easing[]
        // At least some of the easings should be spring-converted functions
        expect(easeArray.some((e) => typeof e === "function")).toBe(true)
    })

    test("It correctly repeats keyframes once", () => {
        const animations = getAnimationDefinitions(
            [[a, { x: [0, 100] }, { duration: 1, repeat: 1, ease: "linear" }]],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([0, 100, 0, 100])
        const { duration, times, ease } = animations.get(a)!.transition.x
        expect(duration).toEqual(2)
        expect(times).toEqual([0, 0.5, 0.5, 1])
        expect(ease).toEqual(["linear", "linear", "linear", "linear"])
    })

    test("It correctly repeats easing", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { x: [0, 50, 100] },
                    { duration: 1, repeat: 1, ease: ["easeIn", "easeOut"] },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([0, 50, 100, 0, 50, 100])
        const { duration, times, ease } = animations.get(a)!.transition.x
        expect(duration).toEqual(2)
        expect(times).toEqual([0, 0.25, 0.5, 0.5, 0.75, 1])
        expect(ease).toEqual([
            "easeIn",
            "easeOut",
            "linear",
            "easeIn",
            "easeOut",
            "easeIn",
        ])
    })

    test("Repeating a segment correctly places the next segment at the end", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { x: [0, 100] }, { duration: 1, repeat: 1 }],
                [a, { y: [0, 100] }, { duration: 2 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        const { keyframes, transition } = animations.get(a)!
        expect(keyframes.x).toEqual([0, 100, 0, 100, null])
        expect(keyframes.y).toEqual([0, 0, 100])

        expect(transition.x.duration).toEqual(4)
        expect(transition.x.times).toEqual([0, 0.25, 0.25, 0.5, 1])
        expect(transition.y.duration).toEqual(4)
        expect(transition.y.times).toEqual([0, 0.5, 1])
    })

    test.skip("It correctly adds repeatDelay between repeated keyframes", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { x: [0, 100] },
                    { duration: 1, repeat: 1, repeatDelay: 0.5 },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([0, 100, 100, 0, 100])
        const { duration, times } = animations.get(a)!.transition.x
        expect(duration).toEqual(2.5)
        expect(times).toEqual([0, 0.4, 0.6, 0.6, 1])
    })

    test.skip("It correctly mirrors repeated keyframes", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { x: [0, 100] },
                    { duration: 1, repeat: 3, repeatType: "mirror" },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([
            0, 100, 100, 0, 0, 100, 100, 0,
        ])
        const { duration, times } = animations.get(a)!.transition.x
        expect(duration).toEqual(4)
        expect(times).toEqual([0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1])
    })

    test.skip("It correctly reverses repeated keyframes", () => {
        const animations = getAnimationDefinitions(
            [
                [
                    a,
                    { x: [0, 100] },
                    { duration: 1, repeat: 3, repeatType: "reverse" },
                ],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(animations.get(a)!.keyframes.x).toEqual([
            0, 100, 100, 0, 0, 100, 100, 0,
        ])
        const { duration, times } = animations.get(a)!.transition.x
        expect(duration).toEqual(4)
        expect(times).toEqual([0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1])
    })

    test("It skips null elements in sequence", () => {
        const animations = getAnimationDefinitions(
            [
                [a, { opacity: 1 }, { duration: 1 }],
                [null as unknown as Element, { opacity: 0.5 }, { duration: 1 }],
                [b, { opacity: 0 }, { duration: 1 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        // Should only have animations for a and b, not the null element
        expect(animations.size).toBe(2)
        expect(animations.has(a)).toBe(true)
        expect(animations.has(b)).toBe(true)
    })

    test("It filters null elements from array of targets", () => {
        const animations = getAnimationDefinitions(
            [[[a, null as unknown as Element, b], { x: 100 }, { duration: 1 }]],
            undefined,
            undefined,
            { spring }
        )

        // Should only have animations for a and b, not the null element
        expect(animations.size).toBe(2)
        expect(animations.has(a)).toBe(true)
        expect(animations.has(b)).toBe(true)
    })

    test("It handles sequence with only null element gracefully", () => {
        const animations = getAnimationDefinitions(
            [[null as unknown as Element, { opacity: 1 }, { duration: 1 }]],
            undefined,
            undefined,
            { spring }
        )

        // Should return empty map when no valid elements
        expect(animations.size).toBe(0)
    })
})

describe("Sequence callbacks", () => {
    const a = document.createElement("div")
    const b = document.createElement("div")

    test("It extracts callbacks with default timing", () => {
        const { callbacks, totalDuration } = createAnimationsFromSequence(
            [
                [a, { x: 100 }, { duration: 1 }],
                [{ onEnter: () => {} }, {}],
                [b, { y: 200 }, { duration: 1 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(1)
        expect(callbacks[0].time).toBe(1) // After first animation
        expect(typeof callbacks[0].onEnter).toBe("function")
        expect(totalDuration).toBe(2)
    })

    test("It extracts callbacks with explicit at timing", () => {
        const { callbacks } = createAnimationsFromSequence(
            [
                [a, { x: 100 }, { duration: 2 }],
                [{ onEnter: () => {} }, { at: 0.5 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(1)
        expect(callbacks[0].time).toBe(0.5)
    })

    test("It extracts callbacks with relative timing", () => {
        const { callbacks } = createAnimationsFromSequence(
            [
                [a, { x: 100 }, { duration: 1 }],
                [{ onEnter: () => {} }, { at: "+0.5" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(1)
        expect(callbacks[0].time).toBe(1.5) // 1s (after anim) + 0.5s offset
    })

    test("It extracts callbacks with < timing", () => {
        const { callbacks } = createAnimationsFromSequence(
            [
                [a, { x: 100 }, { duration: 1 }],
                [b, { y: 200 }, { duration: 1 }],
                [{ onEnter: () => {} }, { at: "<" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(1)
        expect(callbacks[0].time).toBe(1) // Start of previous animation
    })

    test("It extracts multiple callbacks sorted by time", () => {
        const onEnter1 = () => {}
        const onEnter2 = () => {}
        const onEnter3 = () => {}

        const { callbacks } = createAnimationsFromSequence(
            [
                [{ onEnter: onEnter2 }, { at: 1 }],
                [a, { x: 100 }, { duration: 2 }],
                [{ onEnter: onEnter3 }, { at: 1.5 }],
                [{ onEnter: onEnter1 }, { at: 0.5 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(3)
        // Should be sorted by time
        expect(callbacks[0].time).toBe(0.5)
        expect(callbacks[0].onEnter).toBe(onEnter1)
        expect(callbacks[1].time).toBe(1)
        expect(callbacks[1].onEnter).toBe(onEnter2)
        expect(callbacks[2].time).toBe(1.5)
        expect(callbacks[2].onEnter).toBe(onEnter3)
    })

    test("It extracts callbacks with onEnter and onLeave", () => {
        const onEnter = () => {}
        const onLeave = () => {}

        const { callbacks } = createAnimationsFromSequence(
            [
                [a, { x: 100 }, { duration: 1 }],
                [{ onEnter, onLeave }, { at: 0.5 }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(1)
        expect(callbacks[0].onEnter).toBe(onEnter)
        expect(callbacks[0].onLeave).toBe(onLeave)
    })

    test("It extracts callbacks with label-based timing", () => {
        const { callbacks } = createAnimationsFromSequence(
            [
                "my-label",
                [a, { x: 100 }, { duration: 1 }],
                [{ onEnter: () => {} }, { at: "my-label" }],
            ],
            undefined,
            undefined,
            { spring }
        )

        expect(callbacks.length).toBe(1)
        expect(callbacks[0].time).toBe(0) // Label was set at time 0
    })

    test("Callbacks don't affect animation timing", () => {
        const { animationDefinitions, totalDuration } =
            createAnimationsFromSequence(
                [
                    [a, { x: 100 }, { duration: 1 }],
                    [{ onEnter: () => {} }, {}],
                    [{ onEnter: () => {} }, {}],
                    [{ onEnter: () => {} }, {}],
                    [b, { y: 200 }, { duration: 1 }],
                ],
                undefined,
                undefined,
                { spring }
            )

        // Callbacks should not add to the timeline duration
        expect(totalDuration).toBe(2)

        // Animations should be positioned correctly
        expect(animationDefinitions.get(a)!.transition.x.times).toEqual([0, 0.5])
        expect(animationDefinitions.get(b)!.transition.y.times).toEqual([
            0, 0.5, 1,
        ])
    })
})
