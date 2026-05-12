interface IntersectionLog {
    id: string
    isIntersecting: boolean
    time: number
}

function readLogs(win: Window): IntersectionLog[] {
    const el = win.document.getElementById("log-state")
    if (!el) return []
    const raw = el.getAttribute("data-log")
    return raw ? JSON.parse(raw) : []
}

/**
 * Regression test for https://github.com/motiondivision/motion/issues/2679
 *
 * After dragging a Reorder.Item out of view and back in, the
 * IntersectionObserver should fire callbacks reflecting the final visibility
 * state — never leaving an item stuck reporting isIntersecting: false when it
 * is actually visible.
 *
 * The underlying bug is a Chrome IntersectionObserver implementation quirk
 * (it does not reproduce in Electron/Cypress), so this test documents the
 * expected behaviour rather than reliably failing on the unfixed codebase.
 */
describe("Reorder + IntersectionObserver", () => {
    it("Items report isIntersecting: true once visible after a reorder", () => {
        cy.visit("?test=reorder-intersection-observer")
            .wait(200)
            // Drag Test-1 down past Test-2 to trigger a reorder + layout
            // animation, then back to settle.
            .get("#Test-1")
            .trigger("pointerdown", 50, 20, { force: true })
            .wait(50)
            .trigger("pointermove", 50, 40, { force: true })
            .wait(50)
            .trigger("pointermove", 50, 100, { force: true })
            .wait(100)
            .trigger("pointerup", 50, 100, { force: true })
            .wait(500)
            .window()
            .then((win) => {
                const logs = readLogs(win)
                // Every observed item must end its log with
                // isIntersecting: true — none should be stuck "not visible".
                const ids = new Set(logs.map((l) => l.id))
                ids.forEach((id) => {
                    const final = [...logs]
                        .reverse()
                        .find((entry) => entry.id === id)
                    expect(final, `final state for ${id}`).to.exist
                    expect(
                        final!.isIntersecting,
                        `${id} final isIntersecting`
                    ).to.equal(true)
                })
            })
    })
})
