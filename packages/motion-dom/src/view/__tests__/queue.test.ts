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
