const text = (id: string) =>
    cy.get(id).then(([$element]: any) => $element.innerText as string)

describe("scroll() progress callbacks fire on change", () => {
    beforeEach(() => {
        cy.viewport(500, 500).visit("?test=scroll-fire-on-change").wait(200)
    })

    it("Skips frames where progress is unchanged, info callbacks fire every frame", () => {
        cy.get("#progress-calls").should("have.text", "1")
        cy.get("#progress").should("have.text", "0")

        let infoCalls = 0
        text("#info-calls").then((calls) => {
            infoCalls = Number(calls)
        })

        /**
         * The target's offsets resolve to [1000, 2000], so it's out of range
         * for all of these.
         */
        for (const y of [100, 200, 300, 400, 500]) {
            cy.scrollTo(0, y).wait(50)
        }

        text("#progress-calls").then((calls) => {
            expect(calls).to.equal("1")
        })
        text("#info-calls").then((calls) => {
            expect(Number(calls)).to.be.at.least(infoCalls + 5)
        })

        cy.scrollTo(0, 1500).wait(100)
        text("#progress").then((progress) => {
            expect(progress).to.equal("0.5")
        })
        text("#progress-calls").then((calls) => {
            expect(calls).to.equal("2")
        })

        // Past the end of the range in a single frame
        cy.scrollTo(0, 2500).wait(100)
        text("#progress").then((progress) => {
            expect(progress).to.equal("1")
        })
        text("#progress-calls").then((calls) => {
            expect(calls).to.equal("3")
        })

        cy.scrollTo(0, 0).wait(100)
        text("#progress").then((progress) => {
            expect(progress).to.equal("0")
        })
        text("#progress-calls").then((calls) => {
            expect(calls).to.equal("4")
        })
    })

    it("Info callbacks are notified when velocity settles and on resize, progress callbacks aren't", () => {
        // Scroll 20px per frame for 20 frames, staying out of range
        cy.window().then(
            (win) =>
                new Cypress.Promise<void>((resolve) => {
                    let frames = 0
                    const step = () => {
                        win.scrollTo(0, ++frames * 20)
                        frames < 20
                            ? win.requestAnimationFrame(step)
                            : resolve()
                    }
                    win.requestAnimationFrame(step)
                })
        )
        cy.wait(200)

        // Velocity was reported while moving, and settled to 0 once stopped
        text("#info-max-velocity").then((velocity) => {
            expect(Number(velocity)).to.be.greaterThan(0)
        })
        text("#info-velocity").then((velocity) => {
            expect(velocity).to.equal("0")
        })
        text("#info-progress").then((progress) => {
            expect(progress).to.equal("0")
        })
        text("#progress-calls").then((calls) => {
            expect(calls).to.equal("1")
        })

        let infoCalls = 0
        text("#info-calls").then((calls) => {
            infoCalls = Number(calls)
        })

        // A width-only resize doesn't change the target's progress
        cy.viewport(600, 500).wait(200)

        text("#info-calls").then((calls) => {
            expect(Number(calls)).to.be.greaterThan(infoCalls)
        })
        text("#info-progress").then((progress) => {
            expect(progress).to.equal("0")
        })
        text("#progress-calls").then((calls) => {
            expect(calls).to.equal("1")
        })
    })
})
