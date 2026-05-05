import { motionValue } from "../../value"
import { NativeAnimation } from "../NativeAnimation"
import { NativeAnimationExtended } from "../NativeAnimationExtended"

/**
 * cancel() must revert the element to the value at animation start so that
 * its behaviour matches JSAnimation.cancel() (which calls tick(0) to render
 * the first keyframe). Stripping the inline style entirely would lose any
 * value that was persisted by an earlier animation.
 */
describe("NativeAnimation - cancel reverts to first keyframe", () => {
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

    test("cancel() reverts inline style to first keyframe after finish", () => {
        const element = document.createElement("div")
        const mv = motionValue(0)

        const anim = new NativeAnimationExtended({
            element,
            name: "opacity",
            keyframes: [0.25, 1],
            motionValue: mv,
            finalKeyframe: 1,
            onComplete: jest.fn(),
            duration: 300,
            ease: "easeOut",
        } as any)

        mockAnimation.onfinish?.()
        expect(element.style.opacity).toBe("1")

        anim.cancel()
        expect(element.style.opacity).toBe("0.25")
    })

    test("cancel() reverts CSS custom property to first keyframe", () => {
        const element = document.createElement("div")
        const mv = motionValue(0)

        const anim = new NativeAnimationExtended({
            element,
            name: "--my-color",
            keyframes: ["red", "blue"],
            motionValue: mv,
            finalKeyframe: "blue",
            onComplete: jest.fn(),
            duration: 300,
            ease: "easeOut",
        } as any)

        mockAnimation.onfinish?.()
        expect(element.style.getPropertyValue("--my-color")).toBe("blue")

        anim.cancel()
        expect(element.style.getPropertyValue("--my-color")).toBe("red")
    })

    test("cancel() preserves a value previously persisted by another animation", () => {
        const element = document.createElement("div")

        // Earlier animation persisted opacity = "0.5".
        element.style.opacity = "0.5"

        const mv = motionValue(0.5)

        const anim = new NativeAnimationExtended({
            element,
            name: "opacity",
            keyframes: [0.5, 1],
            motionValue: mv,
            finalKeyframe: 1,
            onComplete: jest.fn(),
            duration: 300,
            ease: "easeOut",
        } as any)

        anim.cancel()
        // Must revert to 0.5 — the value before this animation ran —
        // not strip the inline style.
        expect(element.style.opacity).toBe("0.5")
    })

    test("cancel() leaves inline style alone when first keyframe is unresolved", () => {
        const element = document.createElement("div")
        element.style.opacity = "0.5"

        const mv = motionValue(0.5)

        const anim = new NativeAnimationExtended({
            element,
            name: "opacity",
            keyframes: [null, 1],
            motionValue: mv,
            finalKeyframe: 1,
            onComplete: jest.fn(),
            duration: 300,
            ease: "easeOut",
        } as any)

        anim.cancel()
        // First keyframe is null — we don't know the start value, so the
        // pre-existing inline style is preserved rather than overwritten.
        expect(element.style.opacity).toBe("0.5")
    })

    test("stop() preserves committed inline styles", () => {
        const element = document.createElement("div")
        document.body.appendChild(element)

        const anim = new NativeAnimation({
            element,
            name: "opacity",
            keyframes: [0, 1],
            finalKeyframe: 1,
            onComplete: jest.fn(),
            duration: 300,
            ease: "easeOut",
        } as any)

        // Mock commitStyles to set inline style (simulating WAAPI behavior)
        mockAnimation.commitStyles = jest.fn(() => {
            element.style.opacity = "0.5"
        })

        // stop() should preserve the committed style
        anim.stop()
        expect(element.style.opacity).toBe("0.5")
    })
})

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
