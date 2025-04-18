describe("waapi", () => {
    it("Animations are correctly interrupted", () => {
        cy.visit("?test=waapi-interrupt")
            .wait(500)
            .get("#box")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).opacity).not.to.equal("1")
                expect($element.getBoundingClientRect().width).not.to.equal(100)
            })
            .trigger("click", 250, 250, { force: true })
            .wait(100)
            .should(([$element]: any) => {
                expect(getComputedStyle($element).opacity).not.to.equal("1")
                expect(
                    Math.floor($element.getBoundingClientRect().width)
                ).not.to.equal(100)
            })
    })

    it("Default duration doesn't override duration: 0", () => {
        cy.visit("?test=waapi-zero-duration")
            .wait(50)
            .get("#box")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).opacity).to.equal("0")
                expect($element.getBoundingClientRect().width).to.equal(200)
            })
            .trigger("click", 250, 250, { force: true })
            .wait(200)
            .should(([$element]: any) => {
                expect(getComputedStyle($element).opacity).to.equal("1")
                expect(
                    Math.floor($element.getBoundingClientRect().width)
                ).to.equal(100)
            })
    })

    it("Can stop before keyframes resolved", () => {
        cy.visit("?test=waapi-immediate-stop")
            .wait(100)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.innerText).not.to.equal("Error")
            })
            .get("iframe")
            .should((result: any) => {
                expect(result.length).to.equal(0)
            })
    })

    it("Interrupt animations with pre-generated keyframes correctly", () => {
        cy.visit("?test=waapi-interrupt-pregenerated-keyframes")
            .wait(100)
            .get("iframe")
            .should((result: any) => {
                expect(result.length).to.equal(0)
            })
    })

    it("Pregenerates no-op keyframes without error", () => {
        cy.visit("?test=waapi-pregenerate-noop")
            .wait(100)
            .get("iframe")
            .should((result: any) => {
                expect(result.length).to.equal(0)
            })
    })

    // Skipping in CI as it's flaky
    it.skip("Should match WAAPI and main thread startTimes, and allow explicitly setting startTime", () => {
        cy.visit("?test=waapi-sync")
            .wait(2000)
            // Automatically recorded startTime should be the same between main thread and WAAPI
            .get(".auto-timer")
            .should(([waapi, sync]: any) => {
                expect(waapi.innerHTML).to.equal(sync.innerHTML)
            })
            // Explicitly defined startTime should be the same between main thread and WAAPI
            .get(".explicit-timer")
            .should(([waapi, sync]: any) => {
                expect(sync.innerHTML).to.equal("101")
                expect(waapi.innerHTML).to.equal("101")
                expect(waapi.innerHTML).to.equal(sync.innerHTML)
            })
            // Explicitly defined startTime should not be the same as automatically defined startTime
            .get(".sync-timer")
            .should(([syncAuto, syncExplicit]: any) => {
                expect(syncAuto.innerHTML).not.to.equal(syncExplicit.innerHTML)
            })
            .get(".waapi-timer")
            .should(([waapiAuto, waapiExplicit]: any) => {
                expect(waapiAuto.innerHTML).not.to.equal(
                    waapiExplicit.innerHTML
                )
            })
    })
})
