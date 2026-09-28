/**
 * Reorder.Group must not call onReorder again with the same order while the
 * previous order is still pending (onReorder in a transition, or values from
 * useDeferredValue). Unrelated commits used to clear its guard, causing
 * duplicate calls and, with deferred values on React 19, a render loop of
 * one onReorder per pointermove.
 */
describe("Reorder with non-urgent order updates", () => {
    for (const mode of ["useTransition", "deferred"]) {
        it(`calls onReorder once per new order (${mode})`, () => {
            cy.visit(`?test=reorder-transition&mode=${mode}`)
                .get("#drag")
                .click()
                .window({ timeout: 10000 })
                .should((win: any) => expect(win.dragDone).to.equal(true))
                .then((win: any) => {
                    const calls: string[] = win.reorderCalls
                    expect(calls.length).to.be.greaterThan(0)
                    // The drag crosses at most 3 rows.
                    expect(calls.length).to.be.at.most(3)
                    for (let i = 1; i < calls.length; i++) {
                        expect(calls[i]).not.to.equal(calls[i - 1])
                    }
                })
        })
    }
})
