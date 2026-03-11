describe("AnimatePresence with WAAPI animations", () => {
    // Is a differing number in StrictMode even a bug here?
    it("Correct number of animations trigger", () => {
        cy.visit("?test=animate-presence-switch-waapi")
            .wait(100)
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(400)
            .get("#count")
            .should((count: any) => {
                // Strict Mode works differently in 18/19, React 19 may fire more
                expect(count[0].textContent).to.match(/^[234]$/)
            })
    })

    it("Interrupting exiting animation doesn't break exit", () => {
        cy.visit("?test=animate-presence-switch-waapi")
            .wait(100)
            .get(".item")
            .should((items: any) => {
                expect(items.length).to.equal(1)
                expect(items[0].textContent).to.equal("0")
            })
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(100)
            .get(".item")
            .should((items: any) => {
                expect(items.length).to.equal(2)
                expect(items[0].textContent).to.equal("0")
                expect(items[1].textContent).to.equal("1")
            })
            .wait(300)
            .get(".item")
            .should((items: any) => {
                expect(items.length).to.equal(1)
                expect(items[0].textContent).to.equal("1")
            })
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(50)
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(50)
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(400)
            .get(".item")
            .should((items: any) => {
                expect(items.length).to.equal(1)
                expect(items[0].textContent).to.equal("0")
            })
    })

    it("Interrupting exiting animation fire more animations than expected", () => {
        cy.visit("?test=animate-presence-switch-waapi")
            .wait(100)
            .get(".item")
            .should((items: any) => {
                expect(items.length).to.equal(1)
                expect(items[0].textContent).to.equal("0")
            })
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(50)
            .get("#switch")
            .trigger("click", 10, 10, { force: true })
            .wait(400)
            .get("#count")
            .should((count: any) => {
                // Strict Mode works differently in 18/19, React 19 may fire more
                expect(count[0].textContent).to.match(/^[4567]$/)
            })
    })
})
