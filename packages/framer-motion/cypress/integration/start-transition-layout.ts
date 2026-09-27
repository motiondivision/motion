/**
 * Layout animations whose state updates are concurrent: startTransition,
 * useTransition and useDeferredValue. Slow renders (~120ms, see
 * start-transition-helpers) make the concurrent render yield across frames.
 *
 * Motion snapshots, measures and starts layout animations in the commit
 * phase, which is synchronous even for transitions, so renders that yield,
 * are interrupted, batched or abandoned must never cause a jump.
 *
 * Page: dev/react/src/tests/start-transition-layout.tsx
 */
const modes = ["transition", "useTransition", "deferred"]

function run(scenario: string, mode: string) {
    return cy
        .visit(
            `?test=start-transition-layout&mode=${mode}&scenario=${scenario}`
        )
        .get("#run")
        .click()
        .window({ timeout: 10000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

const clickTime = (win: any, id: string) =>
    win.__events.find((e: any) => e.type === "click" && e.data === id).t

const committedValues = (win: any, after: number) =>
    win.__events
        .filter(
            (e: any) =>
                e.type === "commit" && e.data.label === "a" && e.t >= after
        )
        .map((e: any) => e.data.value)

describe("Concurrent React: layout", () => {
    for (const mode of modes) {
        it(`basic (${mode}) animates from the committed position`, () => {
            run("basic", mode).then((win: any) => {
                const a = win.__analyze({
                    name: "a",
                    from: 0,
                    to: 200,
                    after: clickTime(win, "a-next"),
                })
                expect(a.jumps).to.equal(0)
                expect(a.intermediateFrames).to.be.greaterThan(10)
                expect(a.firstMoveProgress).to.be.lessThan(0.15)
                expect(a.finalProgress).to.be.closeTo(1, 0.01)
            })
        })

        it(`rapid (${mode}) batched updates retarget to the final state`, () => {
            run("rapid", mode).then((win: any) => {
                const after = clickTime(win, "a-next")
                const a = win.__analyze({
                    name: "a",
                    from: 0,
                    to: 600,
                    after,
                    jumpFraction: 0.15,
                })
                expect(a.jumps).to.equal(0)
                expect(a.finalProgress).to.be.closeTo(1, 0.01)
                // Intermediate states are skipped, never committed out of order
                const values = committedValues(win, after)
                expect(values[values.length - 1]).to.equal(3)
                expect(values).not.to.include(2)
            })
        })

        it(`interrupt (${mode}) urgent update mid-render animates both`, () => {
            run("interrupt", mode).then((win: any) => {
                const after = clickTime(win, "a-next")
                for (const name of ["a", "b"]) {
                    const box = win.__analyze({ name, from: 0, to: 200, after })
                    expect(box.jumps).to.equal(0)
                    expect(box.intermediateFrames).to.be.greaterThan(10)
                    expect(box.finalProgress).to.be.closeTo(1, 0.01)
                }
            })
        })

        it(`midAnimation (${mode}) reverses from the current visual position`, () => {
            run("midAnimation", mode).then((win: any) => {
                const a = win.__analyze({
                    name: "a",
                    from: 0,
                    to: 200,
                    after: clickTime(win, "a-urgent-next"),
                    jumpFraction: 0.15,
                })
                expect(a.jumps).to.equal(0)
                expect(a.intermediateFrames).to.be.greaterThan(10)
                expect(a.finalProgress).to.be.closeTo(0, 0.01)
            })
        })

        it(`reverseBeforeCommit (${mode}) settles back without jumping`, () => {
            run("reverseBeforeCommit", mode).then((win: any) => {
                const after = clickTime(win, "a-next")
                const a = win.__analyze({
                    name: "a",
                    from: 0,
                    to: 200,
                    after,
                    jumpFraction: 0.15,
                })
                expect(a.jumps).to.equal(0)
                expect(a.finalProgress).to.be.closeTo(0, 0.01)
                /**
                 * A plain startTransition keeps rendering its lane and
                 * commits it before the reversal. With useTransition (whose
                 * isPending update interrupts the render) and
                 * useDeferredValue, both updates batch and the abandoned
                 * state is never committed, so nothing may move.
                 */
                if (mode !== "transition") {
                    expect(committedValues(win, after)).not.to.include(1)
                    expect(a.maxDeltaFraction).to.equal(0)
                }
            })
        })
    }
})
