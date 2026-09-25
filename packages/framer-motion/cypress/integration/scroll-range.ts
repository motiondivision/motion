/**
 * #3001: scroll() rangeStart/rangeEnd should deactivate the animation outside
 * the range, restoring the element's base CSS (opacity 0.1, translateX(300px)).
 *
 * Page height = 5 * 100vh, so with a 1000px viewport scrollLength = 4000px and
 * the page range 0%–20% is 0–800px.
 *
 * #target is 500px tall at top 2500px, so its cover range runs from scroll
 * 1500px (top meets viewport bottom) to 3000px (bottom meets viewport top),
 * and the target range 0%–50% is 1500–2250px.
 *
 * In browsers with ScrollTimeline, the opacity boxes run natively and the x
 * boxes via the JS observe path, so the two paths are checked against each
 * other.
 */
const getX = (transform: string) =>
    transform === "none" ? 0 : parseFloat(transform.split(",")[4])

const expectStyles = (
    opacityId: string,
    xId: string,
    [minOpacity, maxOpacity]: number[],
    [minX, maxX]: number[]
) => {
    cy.get(opacityId).should(([$el]: any) => {
        const opacity = parseFloat(getComputedStyle($el).opacity)
        expect(opacity).to.be.within(minOpacity, maxOpacity)
    })
    cy.get(xId).should(([$el]: any) => {
        expect(getX(getComputedStyle($el).transform)).to.be.within(minX, maxX)
    })
}

const expectInactive = (opacityId: string, xId: string) =>
    expectStyles(opacityId, xId, [0.07, 0.13], [299, 301])

describe("scroll() rangeStart/rangeEnd (#3001)", () => {
    beforeEach(() => {
        cy.viewport(1000, 1000)
        cy.visit("?test=scroll-range").wait(200)
    })

    it("Runs WAAPI values on native timelines where supported", () => {
        cy.window().then((win: any) => {
            if (!win.ScrollTimeline) return

            const timeline = (id: string) =>
                win.document.querySelector(id).getAnimations()[0].timeline

            expect(timeline("#box")).to.be.instanceOf(win.ScrollTimeline)
            expect(timeline("#target-box")).to.be.instanceOf(win.ViewTimeline)
        })
    })

    it("Animates within the page range and deactivates outside it", () => {
        // 600px = 15%, three quarters through the 0%–20% range.
        cy.scrollTo(0, 600).wait(200)
        expectStyles("#box", "#js-box", [0.65, 0.85], [65, 85])

        // 2000px = 50%, past rangeEnd.
        cy.scrollTo(0, 2000).wait(200)
        expectInactive("#box", "#js-box")

        // Scrolling back into the range reactivates the animations.
        cy.scrollTo(0, 600).wait(200)
        expectStyles("#box", "#js-box", [0.65, 0.85], [65, 85])
    })

    it("Resolves the range against the target's cover range", () => {
        // Before the target enters the viewport.
        cy.scrollTo(0, 1000).wait(200)
        expectInactive("#target-box", "#target-js-box")

        // 1875px = cover 25%, halfway through the 0%–50% range.
        cy.scrollTo(0, 1875).wait(200)
        expectStyles("#target-box", "#target-js-box", [0.4, 0.6], [40, 60])

        // 2700px = cover 80%, past rangeEnd.
        cy.scrollTo(0, 2700).wait(200)
        expectInactive("#target-box", "#target-js-box")

        cy.scrollTo(0, 1875).wait(200)
        expectStyles("#target-box", "#target-js-box", [0.4, 0.6], [40, 60])
    })
})
