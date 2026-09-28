/**
 * Layout animations whose state updates are concurrent: startTransition,
 * useTransition and useDeferredValue. Slow renders (~120ms, see
 * start-transition-helpers) make the concurrent render yield across frames.
 *
 * Motion snapshots, measures and starts layout animations in the commit
 * phase, which is synchronous even for transitions, so renders that yield,
 * are interrupted, batched or abandoned must never cause a jump.
 *
 * Each test waits (re-querying) for the final state, then checks the whole
 * sampled path, so slow or stalled frames only delay the checks.
 *
 * Page: dev/react/src/tests/start-transition-layout.tsx
 */
const modes = ["transition", "useTransition", "deferred"]

function run(scenario: string, mode: string) {
    return cy
        .visit(
            `?test=start-transition-layout&mode=${mode}&scenario=${scenario}`
        )
        .nextFrame()
        .nextFrame()
        .get("#run")
        .click()
        .window({ timeout: 15000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

const clickTime = (win: any, id: string) =>
    win.__events.find((e: any) => e.type === "click" && e.data === id).t

const commitsOfA = (win: any, after: number) =>
    win.__events.filter(
        (e: any) => e.type === "commit" && e.data.label === "a" && e.t >= after
    )

const analyzeBox = (win: any, name: string, to: number, clickId: string) =>
    win.__analyze({ name, from: 0, to, after: clickTime(win, clickId) })

describe("Concurrent React: layout", () => {
    for (const mode of modes) {
        it(`basic (${mode}) animates from the committed position`, () => {
            run("basic", mode)
                .should((win: any) =>
                    expect(
                        analyzeBox(win, "a", 200, "a-next").finalProgress
                    ).to.be.closeTo(1, 0.01)
                )
                .then((win: any) => {
                    const a = analyzeBox(win, "a", 200, "a-next")
                    expect(a.jumps).to.equal(0)
                    expect(a.animatedMs).to.be.greaterThan(250)
                })
        })

        it(`rapid (${mode}) batched updates retarget to the final state`, () => {
            run("rapid", mode)
                .should((win: any) =>
                    expect(
                        analyzeBox(win, "a", 600, "a-next").finalProgress
                    ).to.be.closeTo(1, 0.01)
                )
                .then((win: any) => {
                    const after = clickTime(win, "a-next")
                    const a = win.__analyze({
                        name: "a",
                        from: 0,
                        to: 600,
                        after,
                        jumpFraction: 0.15,
                    })
                    expect(a.jumps).to.equal(0)
                    const commits = commitsOfA(win, after)
                    expect(commits[commits.length - 1].data.value).to.equal(3)
                })
        })

        it(`interrupt (${mode}) urgent update mid-render animates both`, () => {
            run("interrupt", mode)
                .should((win: any) => {
                    for (const name of ["a", "b"]) {
                        expect(
                            analyzeBox(win, name, 200, "a-next").finalProgress
                        ).to.be.closeTo(1, 0.01)
                    }
                })
                .then((win: any) => {
                    for (const name of ["a", "b"]) {
                        const box = analyzeBox(win, name, 200, "a-next")
                        expect(box.jumps).to.equal(0)
                        expect(box.animatedMs).to.be.greaterThan(250)
                    }
                })
        })

        it(`midAnimation (${mode}) reverses from the current visual position`, () => {
            const analyzeA = (win: any) =>
                win.__analyze({
                    name: "a",
                    from: 0,
                    to: 200,
                    after: clickTime(win, "a-urgent-next"),
                    jumpFraction: 0.15,
                })
            run("midAnimation", mode)
                .should((win: any) => {
                    const a = analyzeA(win)
                    expect(a.intermediateFrames).to.be.greaterThan(0)
                    expect(a.finalProgress).to.be.closeTo(0, 0.01)
                })
                .then((win: any) => expect(analyzeA(win).jumps).to.equal(0))
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
                 * commits it after the reversal is queued. With useTransition
                 * (whose isPending update interrupts the render) and
                 * useDeferredValue, both updates batch: the abandoned state
                 * must never be committed once the reversal has happened.
                 */
                if (mode !== "transition") {
                    const back = clickTime(win, "a-back")
                    const abandoned = commitsOfA(win, after).find(
                        (e: any) => e.data.value === 1
                    )
                    if (abandoned) {
                        expect(abandoned.t).to.be.lessThan(back)
                    } else {
                        expect(a.maxDeltaFraction).to.equal(0)
                    }
                }
            })
        })
    }
})
