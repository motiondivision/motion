import { GroupPlaybackControls } from "../GroupPlaybackControls"
import { AnimationPlaybackControls } from "../types"

function createTestAnimationControls(
    partialControls?: Partial<AnimationPlaybackControls>
): AnimationPlaybackControls {
    return {
        time: 1,
        speed: 1,
        duration: 10,
        startTime: 0,
        stop: () => {},
        play: () => {},
        pause: () => {},
        then: (resolve: VoidFunction) => {
            return Promise.resolve().then(resolve)
        },
        flatten: () => {},
        complete: () => {},
        cancel: () => {},
        ...partialControls,
    }
}

describe("GroupPlaybackControls", () => {
    test("Filters undefined animations", () => {
        const a: AnimationPlaybackControls = createTestAnimationControls()

        const controls = new GroupPlaybackControls([undefined, a])

        expect(controls.animations[0]).toBe(a)
    })

    test("Gets time", () => {
        const a: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
        })

        const controls = new GroupPlaybackControls([a])

        expect(controls.time).toBe(5)
    })

    test("Sets time", () => {
        const a: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
        })

        const b: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
        })

        const controls = new GroupPlaybackControls([a, b])

        controls.time = 1

        expect(a.time).toBe(1)
        expect(b.time).toBe(1)
    })

    test("Calls play on all animations", () => {
        const a: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
            play: jest.fn(),
        })

        const b: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
            play: jest.fn(),
        })

        const controls = new GroupPlaybackControls([a, b])

        controls.play()

        expect(a.play).toBeCalledTimes(1)
        expect(b.play).toBeCalledTimes(1)
    })

    test("Calls pause on all animations", () => {
        const a: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
            pause: jest.fn(),
        })

        const b: AnimationPlaybackControls = createTestAnimationControls({
            time: 5,
            pause: jest.fn(),
        })

        const controls = new GroupPlaybackControls([a, b])

        controls.pause()

        expect(a.pause).toBeCalledTimes(1)
        expect(b.pause).toBeCalledTimes(1)
    })

    test(".then() returns Promise", () => {
        const controls = new GroupPlaybackControls([])
        controls.then(() => {}).then(() => {})
    })

    test("Resolves if all promises are already resolved", async () => {
        const aOnComplete = jest.fn()
        const a: AnimationPlaybackControls = createTestAnimationControls({})

        const bOnComplete = jest.fn()
        const b: AnimationPlaybackControls = createTestAnimationControls({})

        a.then(() => aOnComplete())
        b.then(() => bOnComplete())

        const controls = new GroupPlaybackControls([a, b])

        await controls

        expect(aOnComplete).toBeCalled()
        expect(bOnComplete).toBeCalled()
    })

    test("Resolves when all promises are resolved", async () => {
        const aOnComplete = jest.fn()
        const a: AnimationPlaybackControls = createTestAnimationControls({})

        const bOnComplete = jest.fn()
        const b: AnimationPlaybackControls = createTestAnimationControls({})

        a.then(() => aOnComplete())
        b.then(() => bOnComplete())

        const controls = new GroupPlaybackControls([a, b])

        await controls

        expect(aOnComplete).toBeCalled()
        expect(bOnComplete).toBeCalled()
    })

    test("Calls cancel on all animations", async () => {
        const a = createTestAnimationControls({
            cancel: jest.fn(),
        })
        const b = createTestAnimationControls({
            cancel: jest.fn(),
        })

        const controls = new GroupPlaybackControls([a, b])

        controls.cancel()

        expect(a.cancel).toBeCalled()
        expect(b.cancel).toBeCalled()
    })

    test("Calls complete on all animations", async () => {
        const a = createTestAnimationControls({
            complete: jest.fn(),
        })
        const b = createTestAnimationControls({
            complete: jest.fn(),
        })

        const controls = new GroupPlaybackControls([a, b])

        controls.complete()

        expect(a.complete).toBeCalled()
        expect(b.complete).toBeCalled()
    })

    test("Gets speed on all animations", async () => {
        const a = createTestAnimationControls({
            speed: 2,
        })
        const b = createTestAnimationControls({
            speed: 2,
        })

        const controls = new GroupPlaybackControls([a, b])

        expect(controls.speed).toEqual(2)
    })

    test("Sets speed on all animations", async () => {
        const a = createTestAnimationControls({
            speed: 2,
        })
        const b = createTestAnimationControls({
            speed: 2,
        })

        const controls = new GroupPlaybackControls([a, b])

        controls.speed = -1
        expect(a.speed).toEqual(-1)
        expect(b.speed).toEqual(-1)
    })

    test("Gets correct startTime", async () => {
        const a = createTestAnimationControls({
            startTime: 2,
        })
        const b = createTestAnimationControls({
            startTime: 2,
        })

        const controls = new GroupPlaybackControls([a, b])

        expect(controls.startTime).toEqual(2)
    })

    test("Gets max duration", async () => {
        const a = createTestAnimationControls({
            duration: 3,
        })
        const b = createTestAnimationControls({
            duration: 2,
        })
        const c = createTestAnimationControls({
            duration: 1,
        })

        const controls = new GroupPlaybackControls([a, b, c])

        expect(controls.duration).toEqual(3)
    })

    test("Returns zero for no animations", async () => {
        const controls = new GroupPlaybackControls([])

        expect(controls.duration).toEqual(0)
    })
})
