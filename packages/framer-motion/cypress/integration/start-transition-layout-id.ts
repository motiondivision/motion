/**
 * Shared layout (layoutId) and LayoutGroup with concurrent state updates:
 * startTransition, useTransition and useDeferredValue, with slow renders
 * that yield across frames.
 *
 * Page: dev/react/src/tests/start-transition-layout-id.tsx
 */
const modes = ["transition", "useTransition", "deferred"]

function run(scenario: string, mode: string) {
    return cy
        .visit(
            `?test=start-transition-layout-id&mode=${mode}&scenario=${scenario}`
        )
        .get("#run")
        .click()
        .window({ timeout: 10000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

const firstClick = (win: any) =>
    win.__events.find((e: any) => e.type === "click").t

describe("Concurrent React: layoutId and LayoutGroup", () => {
    for (const mode of modes) {
        it(`basic (${mode}) underline animates between tabs`, () => {
            run("basic", mode).then((win: any) => {
                const u = win.__analyze({
                    name: "underline",
                    from: 0,
                    to: 400,
                    after: firstClick(win),
                })
                expect(u.jumps).to.equal(0)
                expect(u.intermediateFrames).to.be.greaterThan(10)
                expect(u.firstMoveProgress).to.be.lessThan(0.15)
                expect(u.finalProgress).to.be.closeTo(1, 0.01)
            })
        })

        it(`rapid (${mode}) underline retargets to the last tab`, () => {
            run("rapid", mode).then((win: any) => {
                const u = win.__analyze({
                    name: "underline",
                    from: 0,
                    to: 600,
                    after: firstClick(win),
                    jumpFraction: 0.15,
                })
                expect(u.jumps).to.equal(0)
                expect(u.finalProgress).to.be.closeTo(1, 0.01)
            })
        })

        it(`midAnimation (${mode}) underline reverses from its visual position`, () => {
            run("midAnimation", mode).then((win: any) => {
                const u = win.__analyze({
                    name: "underline",
                    from: 0,
                    to: 400,
                    after: firstClick(win),
                    jumpFraction: 0.15,
                })
                expect(u.jumps).to.equal(0)
                expect(u.finalProgress).to.be.closeTo(0, 0.01)
            })
        })

        it(`group (${mode}) LayoutGroup sibling animates without re-rendering`, () => {
            run("group", mode).then((win: any) => {
                const after = firstClick(win)
                const top = win.__analyze({
                    name: "top",
                    axis: "h",
                    from: 0,
                    to: 200,
                    after,
                })
                const below = win.__analyze({
                    name: "below",
                    axis: "y",
                    from: 0,
                    to: 200,
                    after,
                })
                for (const box of [top, below]) {
                    expect(box.jumps).to.equal(0)
                    expect(box.intermediateFrames).to.be.greaterThan(10)
                    expect(box.finalProgress).to.be.closeTo(1, 0.01)
                }
            })
        })
    }
})
