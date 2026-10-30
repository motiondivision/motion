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

    test("stopping before a pending finish event syncs the value, and the event doesn't apply it later", () => {
        const element = document.createElement("div")
        const mv = motionValue(1)
        const onComplete = jest.fn()

        const animation = new NativeAnimationExtended({
            element,
            name: "opacity",
            keyframes: [1, 0.5],
            motionValue: mv,
            finalKeyframe: 0.5,
            onComplete,
            duration: 0,
            ease: "easeOut",
        } as any)

        // An instant animation is finished before its finish event fires
        mockAnimation.playState = "finished"
        animation.stop()

        // It's showing its end, so that's where the value is now
        expect(mv.get()).toBe(0.5)
        expect(element.style.opacity).toBe("0.5")
        expect(mockAnimation.cancel).toHaveBeenCalled()

        // The next animation sets the value, then the finish event fires
        mv.set(1)
        element.style.opacity = "1"
        mockAnimation.onfinish?.()

        expect(mv.get()).toBe(1)
        expect(element.style.opacity).toBe("1")
        expect(onComplete).not.toHaveBeenCalled()
    })

    test("doesn't leave a frame driver running after sampling its value", () => {
        const running = new Set<object>()
        const driver = () => {
            const controls = {
                start: () => running.add(controls),
                stop: () => running.delete(controls),
                now: () => 0,
            }
            return controls
        }

        const animation = new NativeAnimationExtended({
            element: document.createElement("div"),
            name: "opacity",
            keyframes: [0, 1],
            motionValue: motionValue(0),
            duration: 300,
            driver,
        } as any)

        animation.liveValue()
        animation.updateMotionValue()

        expect(running.size).toBe(0)
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

describe("NativeAnimation - replay after finishing", () => {
    let mockAnimation: any

    beforeEach(() => {
        mockAnimation = {
            cancel: jest.fn(),
            pause: jest.fn(() => (mockAnimation.playState = "paused")),
            play: jest.fn(() => (mockAnimation.playState = "running")),
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
        ;(Element.prototype as any).animate = undefined
        jest.restoreAllMocks()
    })

    test("seeking a finished animation and playing it renews finished", async () => {
        const animation = new NativeAnimation({
            element: document.createElement("div"),
            name: "opacity",
            keyframes: [0, 1],
            duration: 300,
            ease: "linear",
        } as any)

        mockAnimation.onfinish()
        await animation.finished

        animation.time = 0
        animation.play()

        let isResolved = false
        animation.finished.then(() => (isResolved = true))
        await Promise.resolve()
        await Promise.resolve()
        expect(isResolved).toBe(false)

        mockAnimation.onfinish()
        await animation.finished
        expect(isResolved).toBe(true)
    })
})
