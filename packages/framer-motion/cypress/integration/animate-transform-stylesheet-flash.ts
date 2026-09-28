describe("Independent transforms with a stylesheet transform", () => {
    it("Never paint the stylesheet transform", () => {
        cy.visit("?test=animate-transform-stylesheet-flash")
            .wait(1000)
            .get("#box")
            .then(([box]: any) => {
                const samples: string[] = JSON.parse(box.dataset.samples)
                expect(samples.length).to.be.greaterThan(5)

                const painted = samples.filter((transform) => {
                    const match = transform.match(/^matrix\((.+)\)$/u)
                    // x animates from 0 to 200 over 10s, so stays far below
                    // the stylesheet's 100px while sampled
                    return match && parseFloat(match[1].split(",")[4]) > 50
                })
                expect(painted).to.deep.equal([])
            })
    })
})
