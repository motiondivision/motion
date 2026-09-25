/**
 * scroll() rangeStart/rangeEnd map the range onto the animation and hold the
 * first keyframe before it and the last keyframe after it.
 *
 * Page height = 5 * 100vh, so with a 1000px viewport scrollLength = 4000px and
 * the page range 10%–30% is 400–1200px.
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

const expectOpacity = (id: string, progress: number) =>
    cy.get(id).should(([$el]: any) => {
        const opacity = parseFloat(getComputedStyle($el).opacity)
        expect(opacity).to.be.closeTo(progress, 0.05)
    })

const expectX = (id: string, progress: number) =>
    cy.get(id).should(([$el]: any) => {
        const x = getX(getComputedStyle($el).transform)
        expect(x / 100).to.be.closeTo(progress, 0.05)
    })

const scrollThrough = (
    [opacityId, xId]: string[],
    positions: Array<[number, number]>
) => {
    for (const [y, progress] of positions) {
        cy.scrollTo(0, y).wait(200)
        expectOpacity(opacityId, progress)
        expectX(xId, progress)
    }
}

describe("scroll() rangeStart/rangeEnd", () => {
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

    it("Holds either side of the page range", () => {
        scrollThrough(
            ["#box", "#js-box"],
            [
                [0, 0],
                [800, 0.5],
                [2000, 1],
                [800, 0.5],
                [0, 0],
                [2000, 1],
            ]
        )
    })

    it("Holds either side of the target's cover range", () => {
        scrollThrough(
            ["#target-box", "#target-js-box"],
            [
                [1000, 0],
                [1875, 0.5],
                [2700, 1],
                [1875, 0.5],
                [1000, 0],
            ]
        )
    })

    /**
     * The WAAPI boxes aren't checked: NativeAnimation.stop() doesn't stop
     * scroll-driven animations at their scroll position, with or without a
     * range.
     */
    it("Stopping keeps JS values where they are", () => {
        cy.scrollTo(0, 800).wait(200)
        cy.window().then((win: any) => win.stopScroll())
        cy.scrollTo(0, 2000).wait(200)
        expectX("#js-box", 0.5)
        expectX("#target-js-box", 0)
    })
})
