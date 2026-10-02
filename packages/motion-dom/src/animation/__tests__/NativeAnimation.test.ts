import { supportsFlags } from "../../utils/supports/flags"
import { motionValue } from "../../value"
import { NativeAnimation } from "../NativeAnimation"
import { NativeAnimationExtended } from "../NativeAnimationExtended"

/**
 * Tests for the Firefox opacity bug (issue #3552) where the WAAPI animation's
 * onfinish handler needed to commit the final style to the element's inline
 * styles before cancelling the animation. Without this, there was a timing
 * window in Firefox where the WAAPI fill was removed (via cancel()) before
 * the scheduled render could apply the correct value, causing a visual flash
 * back to the initial value.
 */
describe("NativeAnimation - onfinish style commit", () => {
    let mockAnimation: any

    beforeEach(() => {
        mockAnimation = {
            cancel: jest.fn(),
            onfinish: null,
            playbackRate: 1,
            currentTime: 300,
            playState: "running",
            effect: {
                getComputedTiming: () => ({ duration: 300 }),
                updateTiming: jest.fn(),
            },
        }

        Element.prototype.animate = jest
            .fn()
            .mockImplementation(() => mockAnimation)
    })

    afterEach(() => {
        ;(Element.prototype as any).animate = undefined
        jest.restoreAllMocks()
    })

    test("sets element inline style to final value synchronously in onfinish when motionValue is present", () => {
        const element = document.createElement("div")
        const mv = motionValue(0)

        new NativeAnimationExtended({
            element,
            name: "opacity",
            keyframes: [0, 1],
            motionValue: mv,
            finalKeyframe: 1,
            onComplete: jest.fn(),
            duration: 300,
            ease: "easeOut",
        } as any)

        // Simulate the WAAPI onfinish event firing (as Firefox does)
        mockAnimation.onfinish?.()

        /**
         * The element's inline style opacity should be "1" synchronously
         * after onfinish fires, BEFORE any scheduled render runs.
         *
         * This prevents a visual flash in Firefox where animation.cancel()
         * removes the WAAPI fill before the scheduled render can apply
         * the correct value back to the element.
         */
        expect(element.style.opacity).toBe("1")
    })
})

describe("NativeAnimation - attachTimeline", () => {
    let mockAnimation: any

    beforeEach(() => {
        supportsFlags.scrollTimeline = true
        mockAnimation = {
            cancel: jest.fn(),
            onfinish: null,
            playbackRate: 1,
            currentTime: 0,
            playState: "running",
            effect: {
                getComputedTiming: () => ({ duration: 300 }),
                updateTiming: jest.fn(),
            },
        }

        Element.prototype.animate = jest
            .fn()
            .mockImplementation(() => mockAnimation)
    })

    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
        ;(Element.prototype as any).animate = undefined
        jest.restoreAllMocks()
    })

    const createAnimation = () =>
        new NativeAnimation({
            element: document.createElement("div"),
            name: "opacity",
            keyframes: [0, 1],
            duration: 300,
        } as any)

    test("attaches the timeline and passes the WAAPI animation to onAttach", () => {
        const timeline = { currentTime: null }
        const onAttach = jest.fn()
        const observe = jest.fn()

        createAnimation().attachTimeline({ timeline, onAttach, observe })

        expect(mockAnimation.timeline).toBe(timeline)
        expect(onAttach).toHaveBeenCalledWith(mockAnimation)
        expect(observe).not.toHaveBeenCalled()
    })
})
