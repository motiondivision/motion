describe("Shared layout: sticky container not yet engaged", () => {
    it("Layout animation works when sticky ancestor isn't stuck", () => {
        cy.visit("?test=layout-shared-sticky-pre-engagement")
            .wait(50)
            // Click btn-2 so indicator moves there.
            .get("#btn-2")
            .trigger("click")
            .wait(300)
            // Scroll a small amount — well below the engagement threshold
            // (header 500px + sticky top 100px → engages at scrollY >= 400).
            .window()
            .then((win: any) => {
                win.scrollTo(0, 200)
            })
            .wait(100)
            // Confirm the sticky container is genuinely NOT engaged.
            .get("#sticky-container")
            .then(([$sticky]: any) => {
                const rect = $sticky.getBoundingClientRect()
                // At scrollY=200 with header=500, natural top is 300 in viewport.
                // Sticky top: 100 → not engaged because 300 > 100.
                expect(rect.top).to.be.greaterThan(
                    150,
                    `Sticky container should NOT be engaged at scrollY=200 ` +
                        `(rect.top=${rect.top})`
                )
            })
            // Click btn-3 to trigger layoutId animation while not stuck.
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

                // The indicator is animating from btn-2 → btn-3 (10s linear).
                // At ~5% progress it should sit between the two buttons.
                //
                // Buggy behaviour (returning true purely on `position: sticky`
                // without an engagement check) would skip the scroll offset
                // even though sticky is in normal flow here, so the indicator
                // would render ~scrollY pixels off.
                const buttonsMinTop = Math.min(btn2.top, btn3.top)
                const buttonsMaxTop = Math.max(btn2.top, btn3.top)

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
