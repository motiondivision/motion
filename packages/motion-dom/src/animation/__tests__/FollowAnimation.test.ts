import { MotionGlobalConfig } from "motion-utils"
import { frame, frameData, frameSteps } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import { FollowAnimation } from "../FollowAnimation"
import { spring } from "../generators/spring"
import { syncDriver } from "./utils"

function processFrame(timestamp: number) {
    const prevTimestamp = frameData.timestamp
    frameData.timestamp = timestamp
    frameData.delta = timestamp - (prevTimestamp || 0) || 1000 / 60
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

function runUntilDone(animation: FollowAnimation, from = 0, step = 16) {
    let t = from
    while (animation.state === "running" && t < from + 20_000) {
        t += step
        processFrame(t)
    }
    return t
}

const springOptions = {
    type: "spring" as const,
    stiffness: 100,
    damping: 10,
    restDelta: 0.001,
    restSpeed: 0.01,
}

describe("FollowAnimation", () => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
        frameData.timestamp = 0
        time.set(0)
        processFrame(0)
    })

    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })

    test("animates to the target from one shared frame callback", async () => {
        const schedule = jest.spyOn(frame, "update")
        const a: number[] = []
        const b: number[] = []
        const animationA = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onUpdate: (v) => a.push(v),
        })
        const animationB = new FollowAnimation({
            keyframes: [0, 50],
            ...springOptions,
            onUpdate: (v) => b.push(v),
        })

        expect(
            schedule.mock.calls.filter(([, keepAlive]) => keepAlive)
        ).toHaveLength(1)
        expect(animationA.state).toBe("running")

        processFrame(16)
        expect(a).toHaveLength(1)
        expect(a[0]).toBeGreaterThan(0)
        expect(b[0]).toBeGreaterThan(0)

        runUntilDone(animationA, 16)
        runUntilDone(animationB, 16)
        await animationA
        await animationB.finished

        expect(a[a.length - 1]).toBe(100)
        expect(b[b.length - 1]).toBe(50)
        expect(animationA.state).toBe("finished")
        schedule.mockRestore()
    })

    test("restarts the shared frame callback once all followers have finished", () => {
        const schedule = jest.spyOn(frame, "update")
        const first = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onUpdate: () => {},
        })
        runUntilDone(first)
        expect(first.state).toBe("finished")

        const output: number[] = []
        const second = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onUpdate: (v) => output.push(v),
        })
        expect(
            schedule.mock.calls.filter(([, keepAlive]) => keepAlive)
        ).toHaveLength(2)

        processFrame(30_000)
        processFrame(30_016)
        expect(output.length).toBeGreaterThan(0)
        second.stop()
        schedule.mockRestore()
    })

    test("retarget steers a spring in place and completes once at the latest target", async () => {
        const output: number[] = []
        const onComplete = jest.fn()
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onUpdate: (v) => output.push(v),
            onComplete,
        })

        processFrame(16)
        processFrame(32)
        const velocity = animation.getGeneratorVelocity()
        expect(velocity).toBeGreaterThan(0)

        animation.retarget([output[output.length - 1], 1000], velocity)
        expect(animation.state).toBe("running")

        // Time restarts from the retarget, so the next frame samples t=16
        processFrame(48)
        expect(output[2]).toBeGreaterThan(output[1])
        expect(output[2]).toBeLessThan(100)

        runUntilDone(animation, 48)
        await animation

        expect(output[output.length - 1]).toBe(1000)
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("retarget matches a fresh spring created with the same position and velocity", () => {
        const options = {
            stiffness: 100,
            damping: 10,
            restDelta: 0.001,
            restSpeed: 0.01,
        }
        let latest = 0
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            type: "spring",
            ...options,
            onUpdate: (v) => (latest = v),
        })
        let reference = spring({ ...options, keyframes: [0, 100] })

        for (let t = 16; t <= 320; t += 16) {
            processFrame(t)
            const expected = reference.next(16).value
            expect(latest).toBeCloseTo(expected, 8)

            const target = Math.sin(t / 100) * 100
            const velocity = reference.velocity!(16)
            animation.retarget(
                [latest, target],
                animation.getGeneratorVelocity()
            )
            reference = spring({
                ...options,
                keyframes: [expected, target],
                velocity,
            })
        }
        animation.stop()
    })

    test("setTarget steers at the next tick from wherever the spring has reached", async () => {
        const options = {
            stiffness: 100,
            damping: 10,
            restDelta: 0.001,
            restSpeed: 0.01,
        }
        const output: number[] = []
        const onPlay = jest.fn()
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            type: "spring",
            ...options,
            onUpdate: (v) => output.push(v),
            onPlay,
        })
        const reference = spring({ ...options, keyframes: [0, 100] })

        // The first target is applied, and announced, at the first tick
        expect(onPlay).not.toHaveBeenCalled()
        processFrame(16)
        expect(onPlay).toHaveBeenCalledTimes(1)
        processFrame(32)

        // Several targets in one frame collapse into one retarget
        animation.setTarget(500)
        animation.setTarget(1000)
        processFrame(48)
        expect(onPlay).toHaveBeenCalledTimes(2)

        // This frame the spring is wherever the old trajectory put it...
        const position = reference.next(48).value
        expect(output[2]).toBeCloseTo(position, 8)

        // ...and from here follows a fresh spring towards the new target
        const steered = spring({
            ...options,
            keyframes: [position, 1000],
            velocity: reference.velocity!(48),
        })
        processFrame(64)
        expect(output[3]).toBeCloseTo(steered.next(16).value, 8)

        runUntilDone(animation, 64)
        await animation
        expect(output[output.length - 1]).toBe(1000)
    })

    test("setTarget can fix the velocity to steer with", () => {
        const output: number[] = []
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onUpdate: (v) => output.push(v),
        })
        processFrame(16)
        processFrame(32)

        animation.setTarget(1000, 0)
        processFrame(48)
        const position = output[2]
        const steered = spring({
            ...springOptions,
            keyframes: [position, 1000],
            velocity: 0,
        })
        processFrame(64)
        expect(output[3]).toBeCloseTo(steered.next(16).value, 8)
        animation.stop()
    })

    test("retarget recreates generators that can't be steered", async () => {
        const output: number[] = []
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            type: "tween",
            duration: 100,
            ease: "linear",
            onUpdate: (v) => output.push(v),
        })

        processFrame(50)
        expect(output[0]).toBe(50)

        animation.retarget([output[0], 200], 0)
        processFrame(100)
        expect(output[1]).toBeCloseTo(125)

        runUntilDone(animation, 100)
        await animation
        expect(output[output.length - 1]).toBe(200)
    })

    test("only samples the generator at the current frame", () => {
        const generator = spring({ keyframes: [0, 100] })
        const next = jest.spyOn(generator, "next")
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            type: () => generator,
            onUpdate: () => {},
        })

        expect(next).not.toHaveBeenCalled()
        processFrame(16)
        processFrame(32)
        expect(next).toHaveBeenCalledTimes(2)
        expect(next).toHaveBeenLastCalledWith(32)
        animation.stop()
    })

    test("stop() holds the current value and reports idle", () => {
        let latest = 0
        const onStop = jest.fn()
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onUpdate: (v) => (latest = v),
            onStop,
        })

        processFrame(16)
        const held = latest
        animation.stop()
        expect(animation.state).toBe("idle")
        expect(onStop).toHaveBeenCalledTimes(1)

        processFrame(32)
        expect(latest).toBe(held)

        animation.stop()
        expect(onStop).toHaveBeenCalledTimes(1)
    })

    test("holds the first keyframe during a delay", () => {
        const output: number[] = []
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            type: "tween",
            duration: 100,
            ease: "linear",
            delay: 100,
            onUpdate: (v) => output.push(v),
        })

        processFrame(50)
        expect(output[0]).toBe(0)
        processFrame(150)
        expect(output[1]).toBe(50)
        animation.stop()
    })

    test("a delay holds even a generator that is already at rest", () => {
        const output: number[] = []
        const onComplete = jest.fn()
        const animation = new FollowAnimation({
            keyframes: [0, 0.1],
            ...springOptions,
            restDelta: 1,
            restSpeed: 1,
            delay: 100,
            onUpdate: (v) => output.push(v),
            onComplete,
        })

        processFrame(16)
        processFrame(50)
        expect(output).toEqual([0, 0])
        expect(animation.state).toBe("running")
        expect(onComplete).not.toHaveBeenCalled()

        processFrame(116)
        expect(output[2]).toBe(0.1)
        expect(animation.state).toBe("finished")
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("a target set from onUpdate on the finishing frame is not lost", async () => {
        const output: number[] = []
        const onComplete = jest.fn()
        const animation: FollowAnimation = new FollowAnimation({
            keyframes: [0, 100],
            type: "tween",
            duration: 100,
            ease: "linear",
            onUpdate: (v) => {
                output.push(v)
                if (v === 100) animation.setTarget(200)
            },
            onComplete,
        })

        processFrame(100)
        expect(output).toEqual([100])
        expect(animation.state).toBe("running")
        expect(onComplete).not.toHaveBeenCalled()

        runUntilDone(animation, 100)
        await animation
        expect(output[output.length - 1]).toBe(200)
        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    test("stop() from onPlay prevents the first update", () => {
        const onUpdate = jest.fn()
        const onComplete = jest.fn()
        const animation: FollowAnimation = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            onPlay: () => animation.stop(),
            onUpdate,
            onComplete,
        })

        processFrame(16)
        expect(onUpdate).not.toHaveBeenCalled()
        expect(animation.state).toBe("idle")

        processFrame(32)
        expect(onUpdate).not.toHaveBeenCalled()
        expect(onComplete).not.toHaveBeenCalled()
    })

    test("stop() from onUpdate on the finishing frame does not complete", () => {
        const onComplete = jest.fn()
        const onStop = jest.fn()
        const animation: FollowAnimation = new FollowAnimation({
            keyframes: [0, 100],
            type: "tween",
            duration: 100,
            ease: "linear",
            onUpdate: (v) => v === 100 && animation.stop(),
            onComplete,
            onStop,
        })

        processFrame(100)
        expect(animation.state).toBe("idle")
        expect(onStop).toHaveBeenCalledTimes(1)
        expect(onComplete).not.toHaveBeenCalled()
    })

    test("ticks from a custom driver when one is passed", async () => {
        const output: number[] = []
        const animation = new FollowAnimation({
            keyframes: [0, 100],
            ...springOptions,
            driver: syncDriver(10),
            onUpdate: (v) => output.push(v),
        })

        await animation
        expect(output[output.length - 1]).toBe(100)
        expect(output.length).toBeGreaterThan(10)
        expect(animation.state).toBe("finished")
    })
})
