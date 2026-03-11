import { delay } from "motion-dom"

describe("delay", () => {
    test("resolves after provided duration", async () => {
        const startTime = performance.now()

        return new Promise<void>((resolve) => {
            delay(() => {
                const elapsed = performance.now() - startTime
                expect(elapsed > 50 && elapsed < 80).toBe(true)
                resolve()
            }, 50)
        })
    })

    test("provides overshoot duration", async () => {
        return new Promise<void>((resolve) => {
            delay((overshoot) => {
                expect(overshoot).toBeLessThan(50)
                expect(overshoot).toBeGreaterThan(0)
                resolve()
            }, 50)
        })
    })

    test("callback doesn't fire if cancelled", async () => {
        const callback = jest.fn()

        const cancelDelay = delay(callback, 10)

        return new Promise<void>((resolve) => {
            cancelDelay()
            setTimeout(() => {
                expect(callback).not.toBeCalled()
                resolve()
            }, 50)
        })
    })
})
