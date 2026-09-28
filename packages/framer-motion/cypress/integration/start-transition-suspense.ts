/**
 * Suspense with a `layout` parent whose size depends on suspended content.
 *
 * Page: dev/react/src/tests/start-transition-suspense.tsx
 *
 * Known limitations, skipped unless run with `--env known=1`. Both come from
 * the same cause: when React reveals suspended content it doesn't re-render
 * the `layout` ancestor, so getSnapshotBeforeUpdate never runs, no snapshot
 * is taken, and the card jumps.
 *
 * - swap sync: an urgent update suspends a visible boundary, so React shows
 *   the fallback and then reveals the content without re-rendering the card.
 *   Transitions and useDeferredValue keep the old UI and commit the reveal
 *   together with the card, so they animate correctly (tested below).
 * - expand (all modes): a newly mounted boundary always shows its fallback,
 *   even inside a transition, and the reveal has the same jump. expandGroup
 *   tests the workaround: a LayoutGroup plus `layout` fallback and content,
 *   so the fallback unmounting snapshots the group before the reveal.
 */
const knownLimitations = [
    "swap sync",
    "expand sync",
    "expand transition",
    "expand useTransition",
    "expand deferred",
]
const test = (key: string) =>
    knownLimitations.includes(key) && !Cypress.env("known") ? it.skip : it

function run(scenario: string, mode: string) {
    return cy
        .visit(
            `?test=start-transition-suspense&mode=${mode}&scenario=${scenario}`
        )
        .nextFrame()
        .nextFrame()
        .get("#run")
        .click()
        .window({ timeout: 15000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

/**
 * Wait (re-querying) for the card to reach its final height, then check the
 * whole sampled path.
 */
const settled = (to: number) => (win: any) =>
    expect(analyzeCard(win, to).finalProgress).to.be.closeTo(1, 0.01)

const analyzeCard = (win: any, to: number) =>
    win.__analyze({
        name: "card",
        axis: "h",
        from: 0,
        to,
        after: win.__events.find((e: any) => e.type === "click").t,
        jumpFraction: 0.2,
    })

const fallbackShown = (win: any) =>
    win.__events.some(
        (e: any) => e.type === "commit" && e.data.label === "fallback"
    )

describe("Concurrent React: Suspense", () => {
    for (const mode of ["sync", "transition", "useTransition", "deferred"]) {
        test(`swap ${mode}`)(
            `swap (${mode}) visible boundary suspends: card animates to revealed content`,
            () => {
                run("swap", mode)
                    .should(settled(200))
                    .then((win: any) => {
                        const card = analyzeCard(win, 200)
                        expect(card.jumps).to.equal(0)
                        expect(card.animatedMs).to.be.greaterThan(250)
                        if (mode !== "sync")
                            expect(fallbackShown(win)).to.equal(false)
                    })
            }
        )

        test(`expand ${mode}`)(
            `expand (${mode}) new boundary suspends: card animates to revealed content`,
            () => {
                run("expand", mode)
                    .should(settled(300))
                    .then((win: any) =>
                        expect(analyzeCard(win, 300).jumps).to.equal(0)
                    )
            }
        )
    }

    for (const mode of ["sync", "transition"]) {
        it(`expandGroup (${mode}) LayoutGroup + layout fallback animates the reveal`, () => {
            run("expandGroup", mode)
                .should(settled(300))
                .then((win: any) =>
                    expect(analyzeCard(win, 300).jumps).to.equal(0)
                )
        })
    }
})
