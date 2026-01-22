/**
 * Tests for SVG drag behavior with mismatched viewBox and rendered dimensions.
 *
 * When an SVG has viewBox="0 0 100 100" but width/height="500",
 * dragging should correctly transform pointer coordinates to match
 * the SVG's coordinate system.
 *
 * The scale factor is calculated as: viewBoxDimension / renderedDimension
 * For viewBox 100x100 at 500x500 pixels: scale = 100/500 = 0.2
 *
 * So moving the mouse 100 pixels should move the element 20 SVG units.
 *
 * Note: framer-motion applies transforms to SVG elements via CSS (style.transform),
 * not the SVG transform attribute.
 */

/**
 * Extract translateX and translateY values from a CSS transform string.
 */
function parseTranslate(transform: string): { x: number; y: number } {
    const xMatch = transform.match(/translateX\(([-\d.]+)px\)/)
    const yMatch = transform.match(/translateY\(([-\d.]+)px\)/)
    return {
        x: xMatch ? parseFloat(xMatch[1]) : 0,
        y: yMatch ? parseFloat(yMatch[1]) : 0,
    }
}

describe("Drag SVG with viewBox", () => {
    it("Correctly scales drag distance when viewBox differs from rendered size", () => {
        // viewBox is 100x100, rendered size is 500x500
        // Scale factor (screen to SVG): 100/500 = 0.2
        // Rect starts at SVG coords (10, 10) with size (20, 20)
        // Screen position = SVG coords * 5 (due to 500/100 ratio)
        // Initial screen position: (10*5, 10*5) = (50, 50) relative to SVG
        cy.visit("?test=drag-svg-viewbox")
            .wait(50)
            .get("[data-testid='draggable']")
            .should(($draggable: any) => {
                // Verify initial position
                const draggable = $draggable[0] as SVGRectElement
                expect(draggable.getAttribute("x")).to.equal("10")
                expect(draggable.getAttribute("y")).to.equal("10")
            })
            .trigger("pointerdown", 10, 10, { force: true })
            .wait(50)
            .trigger("pointermove", 20, 20, { force: true }) // Move past threshold
            .wait(50)
            // Move 100 pixels in screen space
            // This should translate to 20 SVG units (100 * 0.2)
            // Final SVG coords: (10+20, 10+20) = (30, 30)
            // Final screen position: (30*5, 30*5) = (150, 150) relative to SVG
            .trigger("pointermove", 110, 110, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as SVGRectElement
                // Check CSS transform which framer-motion uses for SVG elements
                const { x, y } = parseTranslate(draggable.style.transform)
                // The element should have moved ~20 SVG units (100px * 0.2 scale)
                // Allow some tolerance for Cypress coordinate handling
                expect(x).to.be.closeTo(20, 3)
                expect(y).to.be.closeTo(20, 3)
            })
    })

    it("Works correctly when viewBox matches rendered size (no scaling)", () => {
        // viewBox and rendered size both 500x500 - no scaling needed
        cy.visit(
            "?test=drag-svg-viewbox&viewBoxWidth=500&viewBoxHeight=500&svgWidth=500&svgHeight=500"
        )
            .wait(50)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 10, 10, { force: true })
            .wait(50)
            .trigger("pointermove", 20, 20, { force: true })
            .wait(50)
            .trigger("pointermove", 110, 110, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as SVGRectElement
                const { x, y } = parseTranslate(draggable.style.transform)
                // No scaling - 100px movement = 100 SVG units
                // Allow ~15% tolerance for Cypress coordinate handling variance
                expect(x).to.be.closeTo(100, 15)
                expect(y).to.be.closeTo(100, 15)
            })
    })

    it("Handles non-uniform scaling (different x and y scale factors)", () => {
        // viewBox is 100x200, rendered is 500x400
        // X scale: 100/500 = 0.2, Y scale: 200/400 = 0.5
        cy.visit(
            "?test=drag-svg-viewbox&viewBoxWidth=100&viewBoxHeight=200&svgWidth=500&svgHeight=400"
        )
            .wait(50)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 10, 10, { force: true })
            .wait(50)
            .trigger("pointermove", 20, 20, { force: true })
            .wait(50)
            // Move 100 pixels in both directions
            // X: 100 * 0.2 = 20 SVG units
            // Y: 100 * 0.5 = 50 SVG units
            .trigger("pointermove", 110, 110, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as SVGRectElement
                const { x, y } = parseTranslate(draggable.style.transform)
                // Allow some tolerance for Cypress coordinate handling
                expect(x).to.be.closeTo(20, 3)
                expect(y).to.be.closeTo(50, 8)
            })
    })
})
