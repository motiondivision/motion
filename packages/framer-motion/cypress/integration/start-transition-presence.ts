/**
 * AnimatePresence (sync / popLayout) with concurrent state updates, with slow
 * renders that yield across frames. mode="wait" is in
 * start-transition-presence-wait.ts.
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
        .get("#run")
        .click()
        .window({ timeout: 10000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

const firstClick = (win: any) =>
    win.__events.find((e: any) => e.type === "click").t

const commitTime = (win: any, value: string) =>
    win.__events.find(
        (e: any) =>
            e.type === "commit" &&
            e.data.label === "items" &&
            e.data.value === value
    ).t

function expectItems(ids: string[]) {
    cy.get("[data-track^=item-]").should(($els: any) => {
        const els = Array.from($els) as HTMLElement[]
        expect(els.map((el) => el.dataset.track)).to.deep.equal(
            ids.map((id) => `item-${id}`)
        )
        els.forEach((el) =>
            expect(parseFloat(getComputedStyle(el).opacity)).to.equal(1)
        )
    })
}

describe("Concurrent React: AnimatePresence", () => {
    for (const presence of ["sync", "popLayout"]) {
        for (const mode of [...modes, "deferred"]) {
            it(`remove (${presence}, ${mode}) exits and siblings animate`, () => {
                run("remove", mode, presence).then((win: any) => {
                    const after = firstClick(win)
                    const b = win.__analyze({
                        name: "item-B",
                        axis: "opacity",
                        from: 1,
                        to: 0,
                        after,
                    })
                    const c = win.__analyze({
                        name: "item-C",
                        axis: "y",
                        from: 0,
                        to: -100,
                        after,
                    })
                    expect(b.intermediateFrames).to.be.greaterThan(10)
                    expect(b.jumps).to.equal(0)
                    expect(c.jumps).to.equal(0)
                    expect(c.intermediateFrames).to.be.greaterThan(10)
                    expect(c.finalProgress).to.be.closeTo(1, 0.01)

                    const sinceCommit = c.firstMoveAt - commitTime(win, "AC")
                    if (presence === "popLayout") {
                        expect(sinceCommit).to.be.lessThan(100)
                    } else {
                        // Siblings move once the 0.5s exit completes
                        expect(sinceCommit).to.be.greaterThan(400)
                    }
                })
                expectItems(["A", "C"])
            })
        }

        for (const mode of modes) {
            it(`toggleBeforeCommit (${presence}, ${mode}) ends where it started`, () => {
                run("toggleBeforeCommit", mode, presence).then((win: any) => {
                    const c = win.__analyze({
                        name: "item-C",
                        axis: "y",
                        from: 0,
                        to: -100,
                        after: firstClick(win),
                    })
                    expect(c.jumps).to.equal(0)
                    expect(c.finalProgress).to.be.closeTo(0, 0.01)
                    /**
                     * useTransition batches the removal and re-add, so the
                     * removal is never committed. A plain startTransition
                     * may commit it first (see start-transition-layout.ts).
                     */
                    if (mode === "useTransition") {
                        expect(c.maxDeltaFraction).to.equal(0)
                    }
                })
                expectItems(["A", "B", "C"])
            })

            it(`reenterMidExit (${presence}, ${mode}) B re-enters once`, () => {
                run("reenterMidExit", mode, presence).then((win: any) => {
                    const c = win.__analyze({
                        name: "item-C",
                        axis: "y",
                        from: 0,
                        to: -100,
                        after: firstClick(win),
                    })
                    expect(c.jumps).to.equal(0)
                    expect(c.finalProgress).to.be.closeTo(0, 0.01)
                })
                expectItems(["A", "B", "C"])
            })

            it(`exitDuringTransition (${presence}, ${mode}) exit completes while a transition renders`, () => {
                run(
                    "exitDuringTransition",
                    mode,
                    presence,
                    "&slowCount=30"
                ).then((win: any) => {
                    const c = win.__analyze({
                        name: "item-C",
                        axis: "y",
                        from: 0,
                        to: -100,
                        after: firstClick(win),
                    })
                    expect(c.jumps).to.equal(0)
                    expect(c.finalProgress).to.be.closeTo(1, 0.01)
                })
                expectItems(["A", "C", "D"])
            })
        }
    }
})
