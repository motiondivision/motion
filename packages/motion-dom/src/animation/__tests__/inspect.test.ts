import { frame, frameData } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { createProjectionNode } from "../../projection/node/create-projection-node"
import { JSAnimation } from "../JSAnimation"
import { NativeAnimation } from "../NativeAnimation"
import { NativeAnimationWrapper } from "../NativeAnimationWrapper"

const inspectGlobal = globalThis as unknown as {
    __MOTION_INSPECT__?: (record: any) => void
}

function nativeAnimation() {
    return {
        cancel: jest.fn(),
        pause: jest.fn(),
        play: jest.fn(),
        onfinish: null,
        playbackRate: 1,
        currentTime: 0,
        playState: "paused",
        effect: {
            target: document.createElement("div"),
            getComputedTiming: () => ({ duration: 300 }),
            updateTiming: jest.fn(),
        },
    } as unknown as Animation
}

describe("animation inspection", () => {
    afterEach(() => {
        delete inspectGlobal.__MOTION_INSPECT__
        jest.restoreAllMocks()
    })

    test("reports a JavaScript animation once with its resolved options and frame time", () => {
        const inspect = jest.fn()
        inspectGlobal.__MOTION_INSPECT__ = inspect
        time.set(123)
        const animation = new JSAnimation({
            keyframes: [0, 100],
            duration: 400,
            autoplay: false,
        })
        expect(inspect).toHaveBeenCalledTimes(1)
        expect(inspect).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: "animation-start",
                animation,
                options: expect.objectContaining({
                    keyframes: [0, 100],
                    duration: 400,
                }),
                timestamp: 123,
                frameTimestamp: frameData.timestamp,
                frameIsProcessing: frameData.isProcessing,
            })
        )
        animation.stop()
    })

    test("reports native and wrapped animations once after the handle is attached", () => {
        const inspect = jest.fn()
        inspectGlobal.__MOTION_INSPECT__ = inspect
        const native = nativeAnimation()
        const oldAnimate = Element.prototype.animate
        Element.prototype.animate = jest.fn(() => native)
        try {
            const element = document.createElement("div")
            const animation = new NativeAnimation({
                element,
                name: "opacity",
                keyframes: [0, 1],
                duration: 300,
                autoplay: false,
            })
            expect(inspect).toHaveBeenCalledTimes(1)
            const record = inspect.mock.calls[0][0]
            expect(record.kind).toBe("animation-start")
            expect(record.animation).toBe(animation)
            expect(record.options.element).toBe(element)
            expect(record.options.name).toBe("opacity")
            expect(record.options.keyframes).toEqual([0, 1])
            expect(record.options.duration).toBe(300)
            inspect.mockClear()
            const wrapper = new NativeAnimationWrapper(native)
            expect(inspect).toHaveBeenCalledTimes(1)
            expect(inspect.mock.calls[0][0].kind).toBe("animation-start")
            expect(inspect.mock.calls[0][0].animation).toBe(wrapper)
            expect(inspect.mock.calls[0][0].options).toEqual({})
        } finally {
            Element.prototype.animate = oldAnimate
        }
    })

    test("reports layout progress with its projection node in the starting frame", async () => {
        const records: any[] = []
        inspectGlobal.__MOTION_INSPECT__ = (record) => records.push(record)
        const ProjectionNode = createProjectionNode({
            measureScroll: () => ({ x: 0, y: 0 }),
            checkIsScrollRoot: () => false,
        })
        const node = new ProjectionNode({})
        node.mixTargetDelta = jest.fn()
        node.startAnimation({ keyframes: [0, 1000], duration: 1 })
        await new Promise<void>((resolve) => frame.postRender(() => resolve()))
        const recordsForLayout = records.filter(
            (record) => record.kind === "layout-animation-start"
        )
        expect(recordsForLayout).toHaveLength(1)
        expect(recordsForLayout[0]).toMatchObject({
            node,
            animation: node.currentAnimation,
            frameTimestamp: frameData.timestamp,
            frameIsProcessing: true,
        })
        node.currentAnimation?.stop()
    })

    test("an absent or throwing inspector cannot interrupt animation construction", () => {
        expect(() =>
            new JSAnimation({ keyframes: [0, 1], autoplay: false }).stop()
        ).not.toThrow()
        inspectGlobal.__MOTION_INSPECT__ = () => {
            throw new Error("inspector failed")
        }
        const animation = new JSAnimation({
            keyframes: [0, 1],
            duration: 300,
            autoplay: false,
        })
        expect(animation.duration).toBe(0.3)
        animation.stop()
    })
})
