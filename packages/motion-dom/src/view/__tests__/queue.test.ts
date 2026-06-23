import { animateView } from "../index"

/**
 * JSDOM has no `startViewTransition`, so these exercise the fallback path and
 * the queue wiring around it.
 */
describe("animateView queue error handling", () => {
    afterEach(() => {
        document.body.innerHTML = ""
    })

    test("rejects (rather than hanging) when the update throws", async () => {
        expect(document.startViewTransition).toBeUndefined()

        const builder = animateView(() => {
            throw new Error("boom")
        })

        await expect(builder).rejects.toThrow("boom")
    })

    test("a failed transition still lets the next queued transition run", async () => {
        expect(document.startViewTransition).toBeUndefined()

        // First builder throws; if the queue stalls, the second never resolves.
        animateView(() => {
            throw new Error("boom")
        }).then(
            () => {},
            () => {}
        )

        const ran = jest.fn()
        await animateView(() => {
            ran()
        })

        expect(ran).toHaveBeenCalledTimes(1)
    })
})

/**
 * Drive the real `startViewTransition` path with a mock so we can model a
 * transition the browser skips (e.g. an `interrupt: "immediate"` supersede),
 * which JSDOM can't produce on its own.
 */
describe("animateView with a skipped/interrupted transition", () => {
    afterEach(() => {
        delete (document as any).startViewTransition
        document.body.innerHTML = ""
    })

    test("resolves (rather than throwing) when the browser skips the transition", async () => {
        const update = jest.fn()
        // The update callback runs and completes, but `ready` rejects - exactly
        // what happens when a later transition interrupts this one.
        ;(document as any).startViewTransition = (cb: () => Promise<void>) => {
            const updateCallbackDone = Promise.resolve().then(() => cb())
            return {
                updateCallbackDone,
                ready: updateCallbackDone.then(() =>
                    Promise.reject(new DOMException("skipped", "AbortError"))
                ),
                finished: updateCallbackDone,
                skipTransition: () => {},
            }
        }

        const result = await animateView(() => {
            update()
        })

        expect(update).toHaveBeenCalledTimes(1)
        // Settled with an empty animation, not thrown.
        expect(result).toBeDefined()
    })

    test("still rejects when the update itself throws", async () => {
        ;(document as any).startViewTransition = (cb: () => Promise<void>) => {
            const updateCallbackDone = Promise.resolve().then(() => cb())
            return {
                updateCallbackDone,
                // `ready` rejects as a consequence of the failed update.
                ready: updateCallbackDone.then(
                    () => undefined,
                    (error: unknown) => Promise.reject(error)
                ),
                finished: updateCallbackDone.catch(() => undefined),
                skipTransition: () => {},
            }
        }

        await expect(
            animateView(() => {
                throw new Error("boom")
            })
        ).rejects.toThrow("boom")
    })
})
