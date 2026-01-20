/**
 * Tests for drag behavior when the draggable element has a rotated parent.
 * Issue: https://github.com/motiondivision/motion/issues/3320
 */
describe("Drag with Rotated Parent", () => {
    it("Drags correctly when parent is rotated 180 degrees", () => {
        cy.visit("?test=drag-rotated-parent&rotate=180")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right and down in screen coordinates
                    .trigger("pointermove", 125, 125, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // When dragging right/down with a 180-degree rotated parent,
                        // the element should move right/down in screen space
                        // (not inverted as the bug causes)
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 50)
                        expect(finalRect.top).to.be.greaterThan(initialTop + 50)
                    })
            })
    })

    it("Drags correctly when parent is rotated 90 degrees", () => {
        cy.visit("?test=drag-rotated-parent&rotate=90")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right in screen coordinates
                    .trigger("pointermove", 125, 25, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // The element should move right in screen space
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 50)
                    })
            })
    })

    it("Drags correctly when parent has no rotation", () => {
        cy.visit("?test=drag-rotated-parent&rotate=0")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right and down
                    .trigger("pointermove", 125, 125, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Without rotation, element should move in the same direction
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 50)
                        expect(finalRect.top).to.be.greaterThan(initialTop + 50)
                    })
            })
    })
})

describe("Drag Constraints with Rotated Parent", () => {
    /**
     * NOTE: Constraints are applied in LOCAL coordinate space.
     * With 180° rotation, screen directions are inverted relative to local:
     * - Screen right (+X) = Local left (-X)
     * - Screen left (-X) = Local right (+X)
     * - Screen down (+Y) = Local up (-Y)
     * - Screen up (-Y) = Local down (+Y)
     *
     * So to test `right: 50` (limits local +X), we drag LEFT in screen space.
     */

    it("Respects right constraint when parent is rotated 180 degrees", () => {
        // right: 50 limits local +X movement
        // With 180° rotation, local +X = screen -X (left)
        // So drag LEFT in screen to test the right constraint
        cy.visit("?test=drag-rotated-parent&rotate=180&right=50")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left }
            })
            .then(({ initialLeft }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 20, 25) // Start gesture going left
                    .wait(50)
                    // Drag far to the LEFT in screen (which is +X in local)
                    .trigger("pointermove", -200, 25, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should move left in screen but be constrained
                        // Should not move more than ~50px left in screen
                        expect(finalRect.left).to.be.greaterThan(initialLeft - 60)
                        expect(finalRect.left).to.be.lessThan(initialLeft - 40)
                    })
            })
    })

    it("Respects bottom constraint when parent is rotated 180 degrees", () => {
        // bottom: 50 limits local +Y movement
        // With 180° rotation, local +Y = screen -Y (up)
        // So drag UP in screen to test the bottom constraint
        cy.visit("?test=drag-rotated-parent&rotate=180&bottom=50")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialTop: initialRect.top }
            })
            .then(({ initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 25, 20) // Start gesture going up
                    .wait(50)
                    // Drag far UP in screen (which is +Y in local)
                    .trigger("pointermove", 25, -200, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should move up in screen but be constrained
                        // Should not move more than ~50px up in screen
                        expect(finalRect.top).to.be.greaterThan(initialTop - 60)
                        expect(finalRect.top).to.be.lessThan(initialTop - 40)
                    })
            })
    })

    it("Respects left constraint when parent is rotated 180 degrees", () => {
        // left: -50 limits local -X movement (allows 50px to the left locally)
        // With 180° rotation, local -X = screen +X (right)
        // So drag RIGHT in screen to test the left constraint
        cy.visit("?test=drag-rotated-parent&rotate=180&left=-50")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left }
            })
            .then(({ initialLeft }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 25) // Start gesture going right
                    .wait(50)
                    // Drag far to the RIGHT in screen (which is -X in local)
                    .trigger("pointermove", 300, 25, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should move right in screen but be constrained
                        // Should not move more than ~50px right in screen
                        expect(finalRect.left).to.be.lessThan(initialLeft + 60)
                        expect(finalRect.left).to.be.greaterThan(initialLeft + 40)
                    })
            })
    })

    it("Respects top constraint when parent is rotated 180 degrees", () => {
        // top: -50 limits local -Y movement (allows 50px up locally)
        // With 180° rotation, local -Y = screen +Y (down)
        // So drag DOWN in screen to test the top constraint
        cy.visit("?test=drag-rotated-parent&rotate=180&top=-50")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialTop: initialRect.top }
            })
            .then(({ initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 25, 30) // Start gesture going down
                    .wait(50)
                    // Drag far DOWN in screen (which is -Y in local)
                    .trigger("pointermove", 25, 300, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should move down in screen but be constrained
                        // Should not move more than ~50px down in screen
                        expect(finalRect.top).to.be.lessThan(initialTop + 60)
                        expect(finalRect.top).to.be.greaterThan(initialTop + 40)
                    })
            })
    })

    it("Respects all constraints when parent is rotated 90 degrees", () => {
        cy.visit("?test=drag-rotated-parent&rotate=90&left=-30&right=30&top=-30&bottom=30")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Try to drag far to the right and down (beyond constraints)
                    .trigger("pointermove", 300, 300, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should be constrained within bounds
                        expect(finalRect.left).to.be.lessThan(initialLeft + 40)
                        expect(finalRect.top).to.be.lessThan(initialTop + 40)
                    })
            })
    })

    it("Respects constraints when parent has no rotation", () => {
        cy.visit("?test=drag-rotated-parent&rotate=0&right=100&bottom=100")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Try to drag far to the right and down (beyond constraints)
                    .trigger("pointermove", 300, 300, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should be constrained at 100px
                        expect(finalRect.left).to.be.closeTo(initialLeft + 100, 5)
                        expect(finalRect.top).to.be.closeTo(initialTop + 100, 5)
                    })
            })
    })
})

describe("Drag with Animated Rotating Parent", () => {
    it("Drags correctly while parent is animating rotation (0 to 360 degrees)", () => {
        cy.visit("?test=drag-rotated-parent&animateRotate=true")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Drag to the right in screen coordinates
                    .trigger("pointermove", 125, 25, { force: true })
                    .wait(50)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should have moved from its initial position
                        // The exact position depends on parent rotation at the moment,
                        // but it should have moved approximately in the drag direction
                        const deltaX = finalRect.left - initialLeft
                        const deltaY = finalRect.top - initialTop
                        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
                        // Should have moved a reasonable distance (not stuck, not inverted)
                        expect(distance).to.be.greaterThan(50)
                    })
            })
    })

    it("Continues to follow pointer during animated rotation", () => {
        cy.visit("?test=drag-rotated-parent&animateRotate=true")
            .wait(500) // Wait for animation to start
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                // Start drag
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30)
                    .wait(100)
                    // Move right
                    .trigger("pointermove", 100, 25, { force: true })
                    .wait(200) // Wait while parent continues rotating
                    // Move further right
                    .trigger("pointermove", 175, 25, { force: true })
                    .wait(100)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should have generally moved right from initial position
                        // Even with rotating parent, the drag should track the pointer
                        const deltaX = finalRect.left - initialLeft
                        const deltaY = finalRect.top - initialTop
                        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
                        // Should have moved significantly
                        expect(distance).to.be.greaterThan(80)
                    })
            })
    })

    it("Respects constraints while parent is animating rotation", () => {
        cy.visit("?test=drag-rotated-parent&animateRotate=true&right=50&bottom=50")
            .wait(200)
            .get("[data-testid='draggable']")
            .then(($draggable) => {
                const initialRect = $draggable[0].getBoundingClientRect()
                return { initialLeft: initialRect.left, initialTop: initialRect.top }
            })
            .then(({ initialLeft, initialTop }) => {
                cy.get("[data-testid='draggable']")
                    .trigger("pointerdown", 25, 25)
                    .trigger("pointermove", 30, 30) // Start gesture
                    .wait(50)
                    // Try to drag far beyond constraints
                    .trigger("pointermove", 300, 300, { force: true })
                    .wait(100)
                    .trigger("pointerup", { force: true })
                    .should(($draggable) => {
                        const finalRect = $draggable[0].getBoundingClientRect()
                        // Element should be constrained - movement limited by constraints
                        // With constraints of 50px, element shouldn't move more than ~70px
                        // (accounting for some tolerance due to animation)
                        const deltaX = Math.abs(finalRect.left - initialLeft)
                        const deltaY = Math.abs(finalRect.top - initialTop)
                        expect(deltaX).to.be.lessThan(70)
                        expect(deltaY).to.be.lessThan(70)
                    })
            })
    })
})
