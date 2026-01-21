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
 * Note: Motion applies transforms via CSS style.transform, not the SVG transform attribute.
 */
describe("Drag SVG with viewBox", () => {
    it("Correctly scales drag distance when viewBox differs from rendered size", () => {
        // viewBox is 100x100, rendered size is 500x500
        // Scale factor: 100/500 = 0.2
        // Initial rect position: x=10, y=10
        cy.visit("?test=drag-svg-viewbox")
            .wait(50)
            .get("[data-testid='draggable']")
            .should(($draggable: any) => {
                // Verify initial position in SVG coordinates
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
            // Expected final position: x=10+20=30, y=10+20=30 in SVG coords
            .trigger("pointermove", 110, 110, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .wait(50)
            .should(($draggable: any) => {
                const draggable = $draggable[0] as SVGRectElement
                // Motion applies transforms via CSS, not SVG transform attribute
                const transform = draggable.style.transform
                // The element should have moved 20 SVG units (100px * 0.2 scale)
                // Transform should be approximately "translateX(20px) translateY(20px)"
                expect(transform).to.include("translateX(20px)")
                expect(transform).to.include("translateY(20px)")
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
                // Motion applies transforms via CSS, not SVG transform attribute
                const transform = draggable.style.transform
                // No scaling - 100px movement = 100 SVG units
                expect(transform).to.include("translateX(100px)")
                expect(transform).to.include("translateY(100px)")
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
                // Motion applies transforms via CSS, not SVG transform attribute
                const transform = draggable.style.transform
                expect(transform).to.include("translateX(20px)")
                expect(transform).to.include("translateY(50px)")
            })
    })
})
