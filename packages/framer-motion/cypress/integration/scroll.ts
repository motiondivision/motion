describe("scroll() callbacks", () => {
    it("Fires callback on first frame, before scroll event", () => {
        cy.visit("?test=scroll-callback-first-frame")
            .wait(100)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("2")
            })
    })

    it("Correctly updates window scroll progress callback", () => {
        cy.visit("?test=scroll-container").wait(100)

        cy.get("#container")
            .scrollTo(0, 50)
            .get("#label")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.5")
            })
    })

    it("Correctly measures scroll position", () => {
        cy.visit("?test=scroll-callback-window").wait(100).viewport(100, 400)

        cy.scrollTo(0, 600)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.5")
            })
        cy.viewport(100, 800)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.25")
            })

        cy.get("#error").should(([$element]: any) => {
            expect($element.innerText).to.equal("")
        })
    })

    it("Correctly updates window scroll progress callback, x axis", () => {
        cy.visit("?test=scroll-callback-window-x").wait(100).viewport(400, 100)

        cy.scrollTo(600, 0)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.5")
            })
        cy.viewport(800, 100)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0.25")
            })
    })

    it("Correctly updates element scroll progress callback", () => {
        cy.visit("?test=scroll-callback-element").wait(100)

        cy.get("#scroller")
            .scrollTo(0, 600)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                const progress = parseFloat($element.innerText)
                const isClose = progress >= 0.49 && progress <= 0.51
                expect(isClose).to.equal(true)
            })
    })

    it("Correctly updates element scroll progress callback, x axis", () => {
        cy.visit("?test=scroll-callback-element-x").wait(100)

        cy.get("#scroller")
            .scrollTo(600, 0)
            .wait(200)
            .get("#progress")
            .should(([$element]: any) => {
                const progress = parseFloat($element.innerText)
                const isClose = progress >= 0.49 && progress <= 0.51
                expect(isClose).to.equal(true)
            })
    })
})

describe("scroll() animation", () => {
    it("Updates aniamtion on first frame, before scroll event", () => {
        cy.visit("?test=scroll-animate-window")
            .wait(100)
            .get("#color")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(255, 255, 255)"
                )
            })
    })

    it("Correctly updates window scroll progress callback", () => {
        cy.visit("?test=scroll-animate-window").wait(100).viewport(100, 400)

        cy.scrollTo(0, 600)
            .wait(200)
            .get("#color")
            .should(([$element]: any) => {
                // This is animated by animate and thus uses linear RGB mixing
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(180, 180, 180)"
                )

                // This is animated by animate mini and thus doesn't use linear RGB mixing
                expect(getComputedStyle($element).color).to.equal(
                    "rgb(128, 128, 128)"
                )

                expect(getComputedStyle($element).opacity).to.equal("0.5")
                expect($element.style.transform).to.equal("translateX(50px)")

                expect($element.innerText).to.equal("50")
            })
        cy.viewport(100, 800)
            .wait(200)
            .get("#color")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(221, 221, 221)"
                )
                expect(getComputedStyle($element).color).to.equal(
                    "rgb(64, 64, 64)"
                )
            })
    })
    it("With useAnimateMini, updates animation on first frame, before scroll event", () => {
        cy.visit("?test=scroll-animate-style")
            .wait(100)
            .get("#color")
            .should(([$element]: any) => {
                expect(getComputedStyle($element).backgroundColor).to.equal(
                    "rgb(255, 255, 255)"
                )
            })
    })
})

describe("SVG", () => {
    it("tracks SVG elements as target", () => {
        cy.visit("?test=scroll-svg").wait(100).viewport(100, 400)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("0")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("0")
        })
        cy.scrollTo(0, 25)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("0")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("0")
        })
        cy.scrollTo(0, 75)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("0")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("0")
        })
        cy.scrollTo(0, 500)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("1")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).not.to.equal("1")
        })
        cy.scrollTo(0, 600)
        cy.get("#rect-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("1")
        })
        cy.get("#svg-progress").should(([$element]: any) => {
            expect($element.innerText).to.equal("1")
        })
    })
})

describe("scroll() full width target", () => {
    it("doesn't return progress 1 before it hits its first offset", () => {
        cy.visit("?test=scroll-fill-range")
            .wait(100)
            .get("#content")
            .should(([$element]: any) => {
                expect($element.innerText).to.equal("0")
            })
    })
})
