// Regression for #3658. The ViewTimeline assertion only runs in browsers
// that support ViewTimeline — CI's Electron does not, so it falls back
// to the JS path and there's nothing to assert against.

const scrollToPx = (px: number) =>
    cy.window().then((win) => win.scrollTo(0, px))

const readWaapi = () =>
    cy
        .get("#opacity-probe")
        .then(([$el]: any) => parseFloat(getComputedStyle($el).opacity))

const readJs = () =>
    cy.get("#js-progress").then(([$el]: any) => parseFloat($el.innerText))

describe("useScroll + transformed ancestor (regression for #3658)", () => {
    it("attaches ViewTimeline (not ScrollTimeline) to inner motion components", function () {
        cy.visit("?test=scroll-view-timeline-transformed-parent").wait(500)
        cy.window().then((win) => {
            if (!(win as any).ViewTimeline) return this.skip()
            cy.get("#opacity-probe").then(([$el]: any) => {
                const anims = $el.getAnimations()
                expect(anims).to.have.length.greaterThan(0)
                const a = anims[0]
                expect(a.timeline?.constructor?.name).to.equal("ViewTimeline")
                // The 200vh target is taller than the viewport, so All runs forwards
                expect(a.rangeStart?.rangeName).to.equal("exit-crossing")
                expect(a.rangeEnd?.rangeName).to.equal("entry-crossing")
            })
        })
    })

    it("WAAPI and JS paths agree on the same target across the scroll range", () => {
        cy.visit("?test=scroll-view-timeline-transformed-parent").wait(500)

        cy.window().then((win) => {
            const vh = win.innerHeight
            const stops = [0.5, 1, 1.25, 1.5, 1.75, 2].map((m) => m * vh)
            const drift: number[] = []

            cy.wrap(stops)
                .each((y: number) => {
                    scrollToPx(y)
                    cy.wait(200)
                    readWaapi().then((w) => {
                        readJs().then((j) => drift.push(Math.abs(w - j)))
                    })
                })
                .then(() => {
                    expect(Math.max(...drift)).to.be.lessThan(0.01)
                })
        })
    })
})
