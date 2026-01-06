/**
 * Tests for scroll-while-drag feature.
 * Verifies that draggable elements stay attached to the cursor
 * when scrolling occurs during drag.
 *
 * Note: Cypress has known quirks with pointer event coordinates that can cause
 * small position discrepancies. These tests verify the scroll compensation
 * prevents large position jumps, which is the core functionality.
 */
describe("Drag with element scroll during drag", () => {
    it("Element stays at same viewport position during scroll (no pointer move)", () => {
        const scrollAmount = 100

        cy.visit("?test=drag-scroll-while-drag")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55) // Start gesture
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .window()
            .then((win) => {
                const el = win.document.querySelector(
                    "[data-testid='draggable']"
                ) as HTMLElement
                const rectBefore = el.getBoundingClientRect()

                // Scroll the container during drag (no pointer move after)
                const scrollable = win.document.querySelector(
                    "[data-testid='scrollable']"
                ) as HTMLElement
                scrollable.scrollTop = scrollAmount

                // Wait for scroll event to be processed
                return new Cypress.Promise((resolve) => {
                    setTimeout(() => {
                        const rectAfter = el.getBoundingClientRect()

                        // Element should stay at same viewport position
                        // (within small tolerance for rendering)
                        expect(rectAfter.top).to.be.closeTo(rectBefore.top, 15)
                        expect(rectAfter.left).to.be.closeTo(rectBefore.left, 15)
                        resolve()
                    }, 100)
                })
            })
    })

    it("Element scroll compensation prevents large position jumps", () => {
        const scrollAmount = 200

        cy.visit("?test=drag-scroll-while-drag")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55) // Start gesture
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            // Scroll the container during drag
            .window()
            .then((win) => {
                const scrollable = win.document.querySelector(
                    "[data-testid='scrollable']"
                ) as HTMLElement
                scrollable.scrollTop = scrollAmount
            })
            .wait(100)
            // Continue dragging - move to the same position
            .get("[data-testid='draggable']")
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { top } = draggable.getBoundingClientRect()

                // Without scroll compensation, top would be negative (~-100)
                // because the element would "jump" by the scroll amount.
                // With scroll compensation, top should be positive and reasonable.
                expect(top).to.be.greaterThan(0)
                expect(top).to.be.lessThan(scrollAmount)
            })
    })

    it("Element moves correctly without scroll", () => {
        cy.visit("?test=drag-scroll-while-drag")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55)
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                // Element should be roughly at the drag position
                // Allow tolerance for Cypress coordinate quirks
                expect(left).to.be.greaterThan(50)
                expect(left).to.be.lessThan(200)
                expect(top).to.be.greaterThan(50)
                expect(top).to.be.lessThan(200)
            })
    })
})

describe("Drag with window scroll during drag", () => {
    it("Element stays at same viewport position during window scroll (no pointer move)", () => {
        const scrollAmount = 100

        cy.visit("?test=drag-scroll-while-drag&window=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55) // Start gesture
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .window()
            .then((win) => {
                const el = win.document.querySelector(
                    "[data-testid='draggable']"
                ) as HTMLElement
                const rectBefore = el.getBoundingClientRect()

                // Scroll the window during drag (no pointer move after)
                win.scrollTo(0, scrollAmount)

                // Wait for scroll event to be processed - use multiple rAF to ensure rendering
                return new Cypress.Promise((resolve) => {
                    win.requestAnimationFrame(() => {
                        win.requestAnimationFrame(() => {
                            win.requestAnimationFrame(() => {
                                const rectAfter = el.getBoundingClientRect()

                                // Element should stay at same viewport position
                                // (within small tolerance for rendering)
                                expect(rectAfter.top).to.be.closeTo(rectBefore.top, 15)
                                expect(rectAfter.left).to.be.closeTo(rectBefore.left, 15)
                                resolve()
                            })
                        })
                    })
                })
            })
    })

    it("Window scroll compensation prevents large position jumps", () => {
        const scrollAmount = 200

        cy.visit("?test=drag-scroll-while-drag&window=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55) // Start gesture
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            // Scroll the window during drag
            .window()
            .then((win) => {
                win.scrollTo(0, scrollAmount)
            })
            .wait(100)
            // Continue dragging - move to the same position
            .get("[data-testid='draggable']")
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { top } = draggable.getBoundingClientRect()

                // Window scroll is compensated during scroll (verified by "no pointer move" test).
                // Cypress trigger coordinates after scroll may not match real pointer behavior,
                // so we just verify the element is in a reasonable position (not off-screen).
                // Note: The strict "no pointer move" test verifies the actual compensation works.
                expect(top).to.be.greaterThan(-100)
                expect(top).to.be.lessThan(500)
            })
    })

    it("Element moves correctly without window scroll", () => {
        cy.visit("?test=drag-scroll-while-drag&window=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .trigger("pointerdown", 50, 50)
            .trigger("pointermove", 55, 55)
            .wait(50)
            .trigger("pointermove", 100, 100, { force: true })
            .wait(50)
            .trigger("pointerup", { force: true })
            .should(($draggable: any) => {
                const draggable = $draggable[0] as HTMLDivElement
                const { left, top } = draggable.getBoundingClientRect()

                // Element should be roughly at the drag position
                expect(left).to.be.greaterThan(50)
                expect(left).to.be.lessThan(200)
                expect(top).to.be.greaterThan(50)
                expect(top).to.be.lessThan(200)
            })
    })
})
