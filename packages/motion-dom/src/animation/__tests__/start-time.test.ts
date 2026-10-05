import { frame, frameData, frameSteps } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { motionValue } from "../../value"
import { animateSingleValue } from "../animate/single-value"
import { FollowAnimation } from "../FollowAnimation"
import { keyframes } from "../generators/keyframes"
import { spring } from "../generators/spring"
import { JSAnimation } from "../JSAnimation"

/**
 * Process a frame at a given time. The clock then holds at that time, so
 * anything started before the next frame starts at it, as if a long task
 * had read the clock early.
 */
function processFrame(timestamp: number) {
    frameData.delta = 1000 / 60
    frameData.timestamp = timestamp
    frameData.isProcessing = true
    time.set(timestamp)
    frameSteps.setup.process(frameData)
    frameSteps.read.process(frameData)
    frameSteps.resolveKeyframes.process(frameData)
    frameSteps.preUpdate.process(frameData)
    frameSteps.update.process(frameData)
    frameSteps.preRender.process(frameData)
    frameSteps.render.process(frameData)
    frameSteps.postRender.process(frameData)
    frameData.isProcessing = false
}

const linear = { duration: 1000, ease: "linear" } as const

describe("start time", () => {
    test("an animation whose first frame is long after its start time starts from that frame", () => {
        processFrame(0)
        const x = motionValue(0)
        const animation = animateSingleValue(x, 100, { ...linear, duration: 1 })

        processFrame(100)
        expect(x.get()).toBe(0)
        processFrame(116)
        expect(x.get()).toBeCloseTo(1.6)
        animation.stop()
    })

    test("an animation whose first frame is soon after its start time catches up", () => {
        processFrame(0)
        const x = motionValue(0)
        const animation = animateSingleValue(x, 100, { ...linear, duration: 1 })

        processFrame(30)
        expect(x.get()).toBeCloseTo(3)
        animation.stop()
    })

    test("animations and followers started together stay in sync", () => {
        processFrame(0)
        const x = motionValue(0)
        const followed: number[] = []
        const animation = animateSingleValue(x, 100, { ...linear, duration: 1 })
        const follower = new FollowAnimation({
            keyframes: [0, 100],
            type: keyframes,
            ...linear,
            onUpdate: (v) => followed.push(v),
        })

        processFrame(100)
        processFrame(300)
        expect(x.get()).toBeCloseTo(20)
        expect(followed).toEqual([0, x.get()])

        animation.stop()
        follower.stop()
    })

    test("an animation started in a synchronous flush of a stale frame starts from its first real frame", () => {
        processFrame(0)
        const x = motionValue(0)
        let animation: ReturnType<typeof animateSingleValue> | undefined
        frame.update(() => {
            animation = animateSingleValue(x, 100, { ...linear, duration: 1 })
        })

        // Like the projection's post-commit flush, stamped with the stale clock
        frameData.timestamp = time.now()
        frameData.isProcessing = true
        frameSteps.update.process(frameData)
        frameData.isProcessing = false

        processFrame(100)
        expect(x.get()).toBe(0)
        animation!.stop()
    })

    test("an explicit start time is left alone", () => {
        processFrame(0)
        const output: number[] = []
        const animation = new JSAnimation({
            keyframes: [0, 100],
            ...linear,
            startTime: 0,
            onUpdate: (v) => output.push(v),
        })

        processFrame(100)
        expect(output).toEqual([10])
        animation.stop()
    })

    test("seeking or pausing before the first frame isn't undone", () => {
        processFrame(0)
        const seeked: number[] = []
        const seek = new JSAnimation({
            keyframes: [0, 100],
            ...linear,
            onUpdate: (v) => seeked.push(v),
        })
        seek.time = 0.5

        const paused: number[] = []
        const pause = new JSAnimation({
            keyframes: [0, 100],
            ...linear,
            autoplay: false,
            onUpdate: (v) => paused.push(v),
        })
        pause.time = 0.5
        pause.play()

        processFrame(100)
        expect(seeked).toEqual([60])
        expect(paused).toEqual([60])

        seek.stop()
        pause.stop()
    })

    test("a follower's first start after a long task starts from its first frame", () => {
        processFrame(0)
        const output: number[] = []
        const follower = new FollowAnimation({
            keyframes: [0, 100],
            type: keyframes,
            duration: 100,
            ease: "linear",
            onUpdate: (v) => output.push(v),
        })

        processFrame(100)
        processFrame(150)
        expect(output).toEqual([0, 50])
        follower.stop()
    })

    test("a follower keeps its velocity when its first start moves", () => {
        processFrame(0)
        const options = {
            keyframes: [0, 100],
            stiffness: 100,
            damping: 10,
            velocity: 1000,
        }
        const output: number[] = []
        const follower = new FollowAnimation({
            ...options,
            type: spring,
            onUpdate: (v) => output.push(v),
        })
        const reference = spring(options)

        processFrame(100)
        expect(follower.getGeneratorVelocity()).toBeCloseTo(1000)
        processFrame(116)
        expect(output).toEqual([0, reference.next(16).value])
        follower.stop()
    })

    test("a retarget after a long frame still catches up", () => {
        processFrame(0)
        const output: number[] = []
        const follower = new FollowAnimation({
            keyframes: [0, 100],
            type: keyframes,
            duration: 100,
            ease: "linear",
            onUpdate: (v) => output.push(v),
        })

        processFrame(16)
        follower.setTarget(200)
        processFrame(32)
        processFrame(82)
        expect(output).toEqual([16, 32, 116])
        follower.stop()
    })
})
