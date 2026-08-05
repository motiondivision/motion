import { motionValue } from "../../value"
import { NativeAnimationExtended } from "../NativeAnimationExtended"

/**
 * Tests for WAAPI completion bugs where cancelling the animation before its
 * final styles are committed can briefly reveal the underlying initial style.
 * Issue #3552 needed the final inline style set synchronously for Firefox,
 * while issue #3778 needs the WAAPI styles committed before cancel for Safari.
 */
describe("NativeAnimation - onfinish style commit", () => {
    let mockAnimation: any

    beforeEach(() => {
        mockAnimation = {
            cancel: jest.fn(),
            commitStyles: jest.fn(),
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

    test("commits WAAPI styles before cancelling on finish", () => {
        const element = document.createElement("div")
        document.body.appendChild(element)

        new NativeAnimationExtended({
            element,
            name: "opacity",
            keyframes: [0, 1],
            duration: 300,
            ease: "easeOut",
        } as any)

        mockAnimation.onfinish?.()

        expect(mockAnimation.commitStyles).toHaveBeenCalledTimes(1)
        expect(
            mockAnimation.commitStyles.mock.invocationCallOrder[0]
        ).toBeLessThan(mockAnimation.cancel.mock.invocationCallOrder[0])

        element.remove()
    })
})
