describe("animateMini()", () => {
    it("correctly runs an animation", () => {
        cy.visit("?test=animate-style")
            .wait(200)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().width).to.equal(200)
                expect($element.style.width).to.equal("200px")
            })
    })

    it("complete() correctly finishes the animation", () => {
        cy.visit("?test=animate-style-complete")
            .wait(200)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().width).to.equal(200)
                expect($element.style.width).to.equal("200px")
            })
    })

    it("pause() correctly pauses the animation", () => {
        cy.visit("?test=animate-style-pause")
            .wait(400)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().width).not.to.equal(100)
                expect($element.getBoundingClientRect().width).not.to.equal(200)
                expect($element.style.width).not.to.equal("200px")
            })
    })

    it("autoplay correctly pauses the animation on creation", () => {
        cy.visit("?test=animate-style-autoplay")
            .wait(200)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().width).to.equal(100)
                expect($element.style.width).to.equal("100px")
            })
    })

    it("play correctly resumes the animation", () => {
        cy.visit("?test=animate-style-play")
            .wait(200)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().width).to.equal(200)
                expect($element.style.width).to.equal("200px")
            })
    })

    it("fires its promise on end", () => {
        cy.visit("?test=animate-style-promise")
            .wait(200)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.style.backgroundColor).to.equal("red")
            })
    })

    it("correctly reads wildcard keyframes", () => {
        cy.visit("?test=animate-style-wildcard")
            .wait(200)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.getBoundingClientRect().width).to.equal(200)
                expect($element.style.width).to.equal("200px")
            })
    })

    it("correctly measures duration", () => {
        cy.visit("?test=animate-style-duration")
            .wait(400)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.style.backgroundColor).to.equal("green")
            })
    })

    it("works correctly with stagger", () => {
        cy.visit("?test=animate-style-stagger")
            .wait(500)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.style.opacity).to.equal("1")
            })
    })

    it("works correctly with CSS variables", () => {
        cy.visit("?test=animate-style-css-var")
            .wait(500)
            .get("#box")
            .should(([$element]: any) => {
                expect($element.style.getPropertyValue("--x")).to.equal("500px")
                expect($element.getBoundingClientRect().left).to.equal(500)
            })
    })
})
