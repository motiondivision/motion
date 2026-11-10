import {
    AnimationPlaybackControls,
    bindAccelerate,
    motionValue,
    supportsFlags,
    TimelineWithFallback,
} from "motion-dom"
import { motion } from "../../"
import { render } from "../../jest.setup"

/**
 * A motion value with `accelerate` (as made by useScroll) is played by a
 * WAAPI animation that its factory links to a timeline.
 */
describe("accelerated motion values", () => {
    let waapi: any
    let controls: AnimationPlaybackControls
    let cleanup: jest.Mock
    let unmount: VoidFunction
    let element: HTMLElement

    beforeEach(() => {
        Element.prototype.animate = (() => {}) as any
        jest.spyOn(Element.prototype, "animate").mockImplementation(
            () =>
                (waapi = {
                    cancel: jest.fn(),
                    pause: jest.fn(),
                    play: jest.fn(),
                    effect: {
                        getComputedTiming: () => ({ duration: 1000 }),
                        updateTiming: jest.fn(),
                    },
                } as any)
        )

        cleanup = jest.fn()
        const opacity = motionValue(0)
        opacity.accelerate = {
            bind: bindAccelerate,
            factory: (animation) => {
                controls = animation
                return cleanup
            },
            times: [0, 1],
            keyframes: [0.25, 0.75],
            ease: (v: number) => v,
            duration: 1,
        }

        const result = render(<motion.div style={{ opacity }} />)
        unmount = result.unmount
        element = result.container.firstChild as HTMLElement
    })

    afterEach(() => {
        supportsFlags.scrollTimeline = undefined
        Element.prototype.animate = undefined as any
        jest.restoreAllMocks()
    })

    const timelineWith = (
        timeline: TimelineWithFallback["timeline"]
    ): TimelineWithFallback & { onAttach: jest.Mock; observe: jest.Mock } => ({
        timeline,
        onAttach: jest.fn(),
        observe: jest.fn(() => () => {}),
    })

    test("starts a WAAPI animation of the value", () => {
        const [keyframes, options] = (
            element.animate as jest.Mock
        ).mock.calls.pop()
        expect(keyframes).toEqual({ opacity: [0.25, 0.75], offset: [0, 1] })
        expect(options).toEqual(
            expect.objectContaining({ duration: 1000, fill: "both" })
        )
        expect(typeof options.easing).toBe("string")
    })

    test("links it to a native timeline", () => {
        supportsFlags.scrollTimeline = true
        const timeline = {} as any
        const options = timelineWith(timeline)

        controls.attachTimeline(options)

        expect(waapi.timeline).toBe(timeline)
        expect(waapi.onfinish).toBeNull()
        expect(options.onAttach).toBeCalledWith(waapi)
        expect(options.observe).not.toBeCalled()
    })

    test("is observed from JS without a native timeline", () => {
        supportsFlags.scrollTimeline = false
        const options = timelineWith({} as any)
        const stop = () => {}
        options.observe.mockReturnValue(stop)

        expect(controls.attachTimeline(options)).toBe(stop)

        expect(waapi.timeline).toBeUndefined()
        expect(waapi.onfinish).toBeNull()
        expect(options.onAttach).not.toBeCalled()
        expect(options.observe).toBeCalledTimes(1)

        /**
         * What an observer does with the animation it's given.
         */
        const observed: AnimationPlaybackControls =
            options.observe.mock.calls[0][0]
        observed.pause()
        expect(waapi.pause).toBeCalledTimes(1)

        expect(observed.iterationDuration).toBe(1)
        observed.time = 0.5
        expect(waapi.currentTime).toBe(500)
    })

    test("is observed from JS without a timeline", () => {
        supportsFlags.scrollTimeline = true
        const options = timelineWith(undefined)

        controls.attachTimeline(options)

        expect(waapi.timeline).toBeUndefined()
        expect(options.observe).toBeCalledTimes(1)
    })

    test("commits its end if it finishes before it's linked", () => {
        waapi.onfinish()

        expect(element.style.opacity).toBe("0.75")
        expect(waapi.cancel).toBeCalledTimes(1)
    })

    test("is cancelled when the element unmounts", () => {
        unmount()

        expect(cleanup).toBeCalledTimes(1)
        expect(waapi.cancel).toBeCalledTimes(1)
        expect(waapi.onfinish).toBeNull()
    })
})
