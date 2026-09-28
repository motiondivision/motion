/**
 * AnimatePresence (sync / popLayout) with concurrent state updates, with slow
 * renders that yield across frames. mode="wait" is in
 * start-transition-presence-wait.ts.
 *
 * Each test waits (re-querying) for the final DOM and positions, then checks
 * the whole sampled path, so slow or stalled frames only delay the checks.
 *
 * Page: dev/react/src/tests/start-transition-presence.tsx
 *
 * exitDuringTransition covers B's exit completing while a transition that
 * adds D is rendering: D must still appear (regression test for #3856).
 */
const modes = ["transition", "useTransition"]

function run(scenario: string, mode: string, presence: string, extra = "") {
    return cy
        .visit(
            `?test=start-transition-presence&mode=${mode}&presence=${presence}&scenario=${scenario}${extra}`
        )
        .nextFrame()
        .nextFrame()
        .get("#run")
        .click()
        .window({ timeout: 15000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

const firstClick = (win: any) =>
    win.__events.find((e: any) => e.type === "click").t

const clickTime = (win: any, id: string) =>
    win.__events.find((e: any) => e.type === "click" && e.data === id).t

const commit = (win: any, value: string) =>
    win.__events.find(
        (e: any) =>
            e.type === "commit" &&
            e.data.label === "items" &&
            e.data.value === value
    )

const analyzeItem = (win: any, id: string, axis: string, to: number) =>
    win.__analyze({
        name: `item-${id}`,
        axis,
        from: axis === "opacity" ? 1 : 0,
        to,
        after: firstClick(win),
    })

/**
 * Re-queried until the items, in order and fully faded in, match `ids`, and
 * C has finished moving to `cProgress` (1 = moved up into B's slot).
 */
function settle(ids: string[], cProgress: number) {
    cy.get("[data-track^=item-]").should(($els: any) => {
        const els = Array.from($els) as HTMLElement[]
        expect(els.map((el) => el.dataset.track)).to.deep.equal(
            ids.map((id) => `item-${id}`)
        )
        els.forEach((el) =>
            expect(parseFloat(getComputedStyle(el).opacity)).to.equal(1)
        )
    })
    return cy
        .window({ timeout: 15000 })
        .should((win: any) =>
            expect(
                analyzeItem(win, "C", "y", -100).finalProgress
            ).to.be.closeTo(cProgress, 0.01)
        )
}

describe("Concurrent React: AnimatePresence", () => {
    for (const presence of ["sync", "popLayout"]) {
        for (const mode of [...modes, "deferred"]) {
            it(`remove (${presence}, ${mode}) exits and siblings animate`, () => {
                run("remove", mode, presence)
                settle(["A", "C"], 1).then((win: any) => {
                    const b = analyzeItem(win, "B", "opacity", 0)
                    const c = analyzeItem(win, "C", "y", -100)
                    expect(b.jumps).to.equal(0)
                    expect(c.jumps).to.equal(0)
                    expect(c.animatedMs).to.be.greaterThan(250)
                    // B faded out over its 0.5s exit rather than vanishing
                    expect(b.intermediateFrames).to.be.greaterThan(0)
                    expect(
                        b.lastSampleAt - commit(win, "AC").t
                    ).to.be.greaterThan(400)
                    if (presence === "popLayout") {
                        // Popped out: C moves while B is still exiting
                        expect(c.firstMoveAt).to.be.lessThan(b.lastSampleAt)
                    } else {
                        // C only moves once B has been removed
                        expect(c.firstMoveAt).to.be.greaterThan(b.lastSampleAt)
                    }
                })
            })
        }

        for (const mode of modes) {
            it(`toggleBeforeCommit (${presence}, ${mode}) ends where it started`, () => {
                run("toggleBeforeCommit", mode, presence)
                settle(["A", "B", "C"], 0).then((win: any) => {
                    const c = win.__analyze({
                        name: "item-C",
                        axis: "y",
                        from: 0,
                        to: -100,
                        after: firstClick(win),
                        jumpFraction: 0.15,
                    })
                    expect(c.jumps).to.equal(0)
                    /**
                     * useTransition batches the removal and re-add: once B is
                     * re-added, the removal must never be committed. A plain
                     * startTransition may commit it first (see
                     * start-transition-layout.ts).
                     */
                    if (mode === "useTransition") {
                        const removed = commit(win, "AC")
                        if (removed) {
                            expect(removed.t).to.be.lessThan(
                                clickTime(win, "add-B")
                            )
                        } else {
                            expect(c.maxDeltaFraction).to.equal(0)
                        }
                    }
                })
            })

            it(`reenterMidExit (${presence}, ${mode}) B re-enters once`, () => {
                run("reenterMidExit", mode, presence)
                settle(["A", "B", "C"], 0).then((win: any) =>
                    expect(analyzeItem(win, "C", "y", -100).jumps).to.equal(0)
                )
            })

            it(`exitDuringTransition (${presence}, ${mode}) exit completes while a transition renders`, () => {
                run("exitDuringTransition", mode, presence, "&slowCount=30")
                settle(["A", "C", "D"], 1).then((win: any) =>
                    expect(analyzeItem(win, "C", "y", -100).jumps).to.equal(0)
                )
            })
        }
    }
})
