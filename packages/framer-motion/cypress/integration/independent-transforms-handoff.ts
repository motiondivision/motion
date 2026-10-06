/**
 * Each scenario records the element's position every frame while an
 * accelerated transform animation is handed to the main thread, and reports
 * any frame that stalled, jumped or ran at the wrong speed. See
 * dev/react/src/tests/independent-transforms-handoff.tsx.
 */
const scenarios = [
    "interrupt-sibling",
    "late-join",
    "sibling-main-thread",
    "restart",
    "stop",
    "speed",
    "paused",
    "delay",
    "exit-mode",
    "set-sibling",
    "spring",
    "component-interrupt",
    "component-sibling",
    "component-stop",
]

describe("independent transforms: hand-off to the main thread", () => {
    for (const scenario of scenarios) {
        it(`${scenario} has no dropped or jumped frames`, () => {
            cy.visit(
                `?test=independent-transforms-handoff&scenario=${scenario}`
            )
                .get("#result", { timeout: 10000 })
                .should("not.be.empty")
                .then(([$result]: any) => {
                    const { drops, samples } = JSON.parse($result.textContent)
                    expect(samples.length).to.be.greaterThan(30)
                    expect(drops).to.deep.equal([])
                })
        })
    }
})
