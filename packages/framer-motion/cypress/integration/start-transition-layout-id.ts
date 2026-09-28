/**
 * Shared layout (layoutId) and LayoutGroup with concurrent state updates:
 * startTransition, useTransition and useDeferredValue, with slow renders
 * that yield across frames.
 *
 * Each test waits (re-querying) for the final state, then checks the whole
 * sampled path.
 *
 * Page: dev/react/src/tests/start-transition-layout-id.tsx
 */
const modes = ["transition", "useTransition", "deferred"]

function run(scenario: string, mode: string) {
    return cy
        .visit(
            `?test=start-transition-layout-id&mode=${mode}&scenario=${scenario}`
        )
        .nextFrame()
        .nextFrame()
        .get("#run")
        .click()
        .window({ timeout: 60000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

const firstClick = (win: any) =>
    win.__events.find((e: any) => e.type === "click").t

const analyzeUnderline = (win: any, to: number, jumpFraction?: number) =>
    win.__analyze({
        name: "underline",
        from: 0,
        to,
        after: firstClick(win),
        jumpFraction,
    })

describe("Concurrent React: layoutId and LayoutGroup", () => {
    for (const mode of modes) {
        it(`basic (${mode}) underline animates between tabs`, () => {
            run("basic", mode)
                .should((win: any) =>
                    expect(
                        analyzeUnderline(win, 400).finalProgress
                    ).to.be.closeTo(1, 0.01)
                )
                .then((win: any) => {
                    const u = analyzeUnderline(win, 400)
                    expect(u.jumps).to.equal(0)
                    expect(u.animatedMs).to.be.greaterThan(250)
                })
        })

        it(`rapid (${mode}) underline retargets to the last tab`, () => {
            run("rapid", mode)
                .should((win: any) =>
                    expect(
                        analyzeUnderline(win, 600, 0.15).finalProgress
                    ).to.be.closeTo(1, 0.01)
                )
                .then((win: any) =>
                    expect(analyzeUnderline(win, 600, 0.15).jumps).to.equal(0)
                )
        })

        it(`midAnimation (${mode}) underline reverses from its visual position`, () => {
            run("midAnimation", mode)
                // Re-queried until back on the first tab and stationary
                .should((win: any) => {
                    const u = analyzeUnderline(win, 400, 0.15)
                    expect(u.finalProgress).to.be.closeTo(0, 0.01)
                    expect(u.stillMs).to.be.greaterThan(200)
                })
                .then((win: any) =>
                    expect(analyzeUnderline(win, 400, 0.15).jumps).to.equal(0)
                )
        })

        it(`group (${mode}) LayoutGroup sibling animates without re-rendering`, () => {
            const boxes = (win: any) => {
                const after = firstClick(win)
                return [
                    win.__analyze({
                        name: "top",
                        axis: "h",
                        from: 0,
                        to: 200,
                        after,
                    }),
                    win.__analyze({
                        name: "below",
                        axis: "y",
                        from: 0,
                        to: 200,
                        after,
                    }),
                ]
            }
            run("group", mode)
                .should((win: any) => {
                    for (const box of boxes(win)) {
                        expect(box.finalProgress).to.be.closeTo(1, 0.01)
                    }
                })
                .then((win: any) => {
                    for (const box of boxes(win)) {
                        expect(box.jumps).to.equal(0)
                        expect(box.animatedMs).to.be.greaterThan(250)
                    }
                })
        })
    }
})
