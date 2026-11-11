/**
 * Layout animations with a spring start with the element's current velocity
 * instead of from rest. Tweens take no velocity.
 *
 * Positions are sampled once per animation frame inside the page, so the
 * test measures the first frames after a hand-off and not the settled state.
 */
const leftOfBox = (doc: Document) =>
    doc.getElementById("box")!.getBoundingClientRect().left

function sampleFrames(win: any, count: number) {
    return new Cypress.Promise<number[]>((resolve) => {
        const samples: number[] = []
        const tick = () => {
            samples.push(leftOfBox(win.document))
            samples.length < count
                ? win.requestAnimationFrame(tick)
                : resolve(samples)
        }
        win.requestAnimationFrame(tick)
    })
}

/**
 * Sample the card until the detail view replaces it, then sample the detail
 * view. Returns the card's last left edge and the detail view's samples.
 */
function sampleSwap(win: any, count: number) {
    return new Cypress.Promise<{ atSwap: number; samples: number[] }>(
        (resolve) => {
            const samples: number[] = []
            let atSwap = 0
            const tick = () => {
                const box = win.document.getElementById("box")
                if (box.style.backgroundColor === "blue") {
                    samples.push(leftOfBox(win.document))
                } else {
                    atSwap = leftOfBox(win.document)
                }
                samples.length < count
                    ? win.requestAnimationFrame(tick)
                    : resolve({ atSwap, samples })
            }
            win.requestAnimationFrame(tick)
        }
    )
}

function afterFrame(win: any) {
    return new Cypress.Promise<void>((resolve) =>
        win.requestAnimationFrame(() => resolve())
    )
}

function dispatchPointer(win: any, type: string, x: number, y: number) {
    const target =
        type === "pointerdown" ? win.document.getElementById("box") : win
    target.dispatchEvent(
        new win.PointerEvent(type, {
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            bubbles: true,
            cancelable: true,
        })
    )
}

/**
 * Click the box, wait until the layout animation is moving fast to the
 * right, then click again to send it back to the left. Returns the left
 * edge at the second click and the samples from the frames after it.
 */
function interrupt(query: string) {
    let atInterrupt = 0
    return cy
        .visit(`?test=layout-velocity-interrupt${query}`)
        .wait(200)
        .get("#box")
        .click()
        .wait(250)
        .window()
        .then((win: any) => {
            atInterrupt = leftOfBox(win.document)
            win.document.getElementById("box").click()
            return sampleFrames(win, 6)
        })
        .then((samples: number[]) => ({ atInterrupt, samples }))
}

/**
 * Drag the card right with a fast flick. Release swaps it for a detail view
 * with the same layoutId, down and to the left. Returns the card's left edge
 * just before the swap and the detail view's first frames.
 */
function throwCard(query: string) {
    const y = 150
    return cy
        .visit(`?test=layout-velocity-drag-layout-id${query}`)
        .wait(200)
        .get("#box")
        .nextFrame()
        .nextFrame()
        .window()
        .then((win: any) => {
            dispatchPointer(win, "pointerdown", 350, y)
            dispatchPointer(win, "pointermove", 360, y)
            return afterFrame(win)
        })
        .wait(50)
        .window()
        .then(async (win: any) => {
            for (const x of [380, 400, 420, 440]) {
                dispatchPointer(win, "pointermove", x, y)
                await afterFrame(win)
            }
            dispatchPointer(win, "pointerup", 440, y)
            return sampleSwap(win, 6)
        })
}

describe("Layout velocity", () => {
    it("An interrupted layout animation keeps its velocity", () => {
        interrupt("").then(({ atInterrupt, samples }: any) => {
            // Still moving right after the interrupt, then turns back.
            expect(Math.max(...samples.slice(0, 4))).to.be.greaterThan(
                atInterrupt + 5
            )
        })
    })

    it("An interrupted layout tween starts from rest", () => {
        interrupt("&tween").then(({ atInterrupt, samples }: any) => {
            expect(Math.max(...samples)).to.be.lessThan(atInterrupt + 1)
        })
    })

    it("A thrown card hands its velocity to a layoutId element", () => {
        throwCard("").then(({ atSwap, samples }: any) => {
            // The detail view is to the left, but the first frames follow
            // the throw to the right.
            expect(Math.max(...samples.slice(0, 3))).to.be.greaterThan(
                atSwap + 4
            )
        })
    })

    it("A layoutId tween starts from rest", () => {
        throwCard("&tween").then(({ atSwap, samples }: any) => {
            expect(Math.max(...samples)).to.be.lessThan(atSwap + 1)
        })
    })

    it("A thrown card keeps its size between the card and the detail view", () => {
        const y = 150
        cy.visit("?test=layout-velocity-throw-resize")
            .wait(200)
            .get("#box")
            .nextFrame()
            .nextFrame()
            .window()
            .then((win: any) => {
                dispatchPointer(win, "pointerdown", 350, y)
                dispatchPointer(win, "pointermove", 360, y)
                return afterFrame(win)
            })
            .wait(50)
            .window()
            .then(async (win: any) => {
                for (const x of [400, 440, 480, 520]) {
                    dispatchPointer(win, "pointermove", x, y)
                    await afterFrame(win)
                }
                dispatchPointer(win, "pointerup", 520, y)
                const widths: number[] = []
                for (let i = 0; i < 40; i++) {
                    await afterFrame(win)
                    const box = win.document.getElementById("box")
                    if (box.style.backgroundColor === "blue") {
                        widths.push(box.getBoundingClientRect().width)
                    }
                }
                return widths
            })
            .then((widths: number[]) => {
                // The throw moves the edges together, so the width only
                // travels from the card's 100px to the detail's 400px.
                expect(widths.length).to.be.greaterThan(10)
                expect(Math.min(...widths)).to.be.greaterThan(99)
                expect(Math.max(...widths)).to.be.lessThan(401)
            })
    })

    it("An interrupted spring keeps an edge that doesn't move still", () => {
        cy.visit("?test=layout-velocity-fixed-edge")
            .wait(200)
            .get("#box")
            .click(10, 10)
            .wait(250)
            .window()
            .then((win: any) => {
                win.document.getElementById("box").click()
                return sampleFrames(win, 20)
            })
            .then((samples: number[]) => {
                // Position and size share each axis spring, so the left
                // edge stays at 100px while the box keeps its velocity.
                for (const left of samples) {
                    expect(Math.abs(left - 100)).to.be.lessThan(1)
                }
            })
    })

    it("The default layout transition is a physics spring", () => {
        cy.visit("?test=layout-velocity-default-spring")
            .wait(200)
            .get("#box")
            .click()
            .wait(1500)
            .should(([$el]: any) => {
                // The 0.45s default tween would finish in about 450ms. A 100px box is light (mass 0.33), so the spring settles in about 600ms.
                expect(Number($el.dataset.duration)).to.be.greaterThan(530)
            })
    })

    it("An explicit layout tween stays a tween", () => {
        cy.visit("?test=layout-velocity-default-spring&tween")
            .wait(200)
            .get("#box")
            .click()
            .wait(1500)
            .should(([$el]: any) => {
                expect(Number($el.dataset.duration)).to.be.lessThan(530)
            })
    })
})
