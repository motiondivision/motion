/**
 * scroll() and useScroll() with an offset and no target apply the offset on
 * every path. With a 1000px viewport the page scrolls 4000px, and the offset
 * ["1000px", "2000px"] maps 1000–2000px of scroll onto the animations.
 *
 * In browsers with ScrollTimeline, #box and the accelerated #use-scroll-box
 * could run natively, while #js-box always runs on the JS path.
 */
const getX = (transform: string) =>
    transform === "none" ? 0 : parseFloat(transform.split(",")[4])

const expectProgress = (id: string, progress: number) =>
    cy.get(id).should(([$el]: any) => {
        const style = getComputedStyle($el)
        const value =
            id === "#js-box" ? getX(style.transform) / 100 : +style.opacity
        expect(value).to.be.closeTo(progress, 0.05)
    })

describe("scroll() offset without a target", () => {
    it("Applies the offset to native, JS and useScroll values alike", () => {
        cy.viewport(1000, 1000)
        cy.visit("?test=scroll-page-offset").wait(200)

        for (const [y, progress] of [
            [500, 0],
            [1500, 0.5],
            [2500, 1],
            [1500, 0.5],
            [500, 0],
        ]) {
            cy.scrollTo(0, y).wait(200)
            expectProgress("#box", progress)
            expectProgress("#js-box", progress)
            expectProgress("#use-scroll-box", progress)
        }
    })
})
