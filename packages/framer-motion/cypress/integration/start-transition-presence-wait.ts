/**
 * AnimatePresence mode="wait" with concurrent state updates, with slow
 * renders that yield across frames.
 *
 * Page: dev/react/src/tests/start-transition-presence.tsx
 */
const modes = ["transition", "useTransition", "deferred"]

function run(scenario: string, mode: string) {
    return cy
        .visit(
            `?test=start-transition-presence&mode=${mode}&presence=wait&scenario=${scenario}`
        )
        .get("#run")
        .click()
        .window({ timeout: 10000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

function expectOnly(id: string) {
    cy.get(".wait-child").should("have.length", 1)
    cy.get(`#child-${id}-el`).should("have.css", "opacity", "1")
}

describe("Concurrent React: AnimatePresence mode=wait", () => {
    for (const mode of modes) {
        it(`swap (${mode}) exits A fully before B enters`, () => {
            run("waitSwap", mode).then((win: any) => {
                const after = win.__events.find(
                    (e: any) => e.type === "click"
                ).t
                const a = win.__analyze({
                    name: "child-A",
                    axis: "opacity",
                    from: 1,
                    to: 0,
                    after,
                })
                const b = win.__analyze({
                    name: "child-B",
                    axis: "opacity",
                    from: 0,
                    to: 1,
                    after,
                })
                expect(a.intermediateFrames).to.be.greaterThan(10)
                expect(b.intermediateFrames).to.be.greaterThan(10)
                expect(b.firstMoveAt).to.be.greaterThan(a.reachedEndAt - 1)
            })
            expectOnly("B")
        })

        it(`rapid (${mode}) ends on the last child only`, () => {
            run("waitRapid", mode)
            expectOnly("C")
        })

        it(`midExit (${mode}) switching again mid-exit ends on C`, () => {
            run("waitMidExit", mode)
            expectOnly("C")
        })
    }
})
