describe("Shared layout: sticky container", () => {
    it("Layout animation works inside a sticky container after scrolling", () => {
        cy.visit("?test=layout-shared-sticky")
            .wait(50)
            // Click btn-2 so indicator moves there
            .get("#btn-2")
            .trigger("click")
            .wait(300)
            // Scroll down so sticky container kicks in
            .window()
            .then((win: any) => {
                win.scrollTo(0, 2000)
            })
            .wait(100)
            // Click btn-3 to trigger layoutId animation while sticky
            .get("#btn-3")
            .trigger("click")
            .wait(500)
            .get("#indicator")
            .then(([$indicator]: any) => {
                const appDoc = $indicator.ownerDocument
                const btn2 = (
                    appDoc.querySelector("#btn-2") as HTMLElement
                ).getBoundingClientRect()
                const btn3 = (
                    appDoc.querySelector("#btn-3") as HTMLElement
                ).getBoundingClientRect()
                const indicator = $indicator.getBoundingClientRect()
                const scrollY =
                    appDoc.defaultView.scrollY ||
                    appDoc.defaultView.pageYOffset

                // The indicator is animating from btn-2 to btn-3 (10s linear).
                // At 500ms (~5% progress), it should be between the two buttons.
                //
                // WITHOUT the fix, the starting position is offset by ~scrollY
                // (2000px), so the indicator would be far outside the button range.
                //
                // WITH the fix, the indicator stays within the button area.
                const buttonsMinTop = Math.min(btn2.top, btn3.top)
                const buttonsMaxTop = Math.max(btn2.top, btn3.top)

                // Indicator must be within the button range (with tolerance
                // for animation overshoot). The key assertion: it must NOT
                // be offset by the scroll amount.
                expect(indicator.top).to.be.greaterThan(
                    buttonsMinTop - 50,
                    `Indicator (${indicator.top}) should be near buttons ` +
                        `(${buttonsMinTop}-${buttonsMaxTop}), ` +
                        `not offset by scroll (${scrollY})`
                )
                expect(indicator.top).to.be.lessThan(
                    buttonsMaxTop + 50,
                    `Indicator (${indicator.top}) should be near buttons ` +
                        `(${buttonsMinTop}-${buttonsMaxTop}), ` +
                        `not offset by scroll (${scrollY})`
                )
            })
    })
})
