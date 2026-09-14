import { WithPromise } from "../WithPromise"

class TestAnimation extends WithPromise {
    finish() {
        this.notifyFinished()
    }

    replay() {
        this.updateFinished()
    }
}

describe("WithPromise", () => {
    test("finished resolves when notified after being read", async () => {
        const animation = new TestAnimation()
        let resolved = false
        const promise = animation.finished.then(() => {
            resolved = true
        })

        await Promise.resolve()
        expect(resolved).toBe(false)

        animation.finish()
        await promise
        expect(resolved).toBe(true)
    })

    test("finished resolves when first read after being notified", async () => {
        const animation = new TestAnimation()
        animation.finish()

        await expect(animation.finished).resolves.toBeUndefined()
    })

    test("finished returns the same promise until replayed", () => {
        const animation = new TestAnimation()
        expect(animation.finished).toBe(animation.finished)

        animation.finish()
        expect(animation.finished).toBe(animation.finished)
    })

    test("replaying re-arms finished", async () => {
        const animation = new TestAnimation()
        animation.finish()
        const first = animation.finished

        animation.replay()
        const second = animation.finished
        expect(second).not.toBe(first)

        let resolved = false
        second.then(() => {
            resolved = true
        })
        await Promise.resolve()
        expect(resolved).toBe(false)

        animation.finish()
        await second
        expect(resolved).toBe(true)
    })

    test("a promise read before replaying still resolves", async () => {
        const animation = new TestAnimation()
        const first = animation.finished

        animation.finish()
        animation.replay()

        await expect(first).resolves.toBeUndefined()
    })

    test("then resolves like finished", async () => {
        const animation = new TestAnimation()
        let resolved = false
        animation.then(() => {
            resolved = true
        })

        animation.finish()
        await animation.finished
        expect(resolved).toBe(true)
    })
})
