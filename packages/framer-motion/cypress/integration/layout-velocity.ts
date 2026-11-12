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

    it("An interrupted layout spring with a duration starts from rest", () => {
        interrupt("&duration").then(({ atInterrupt, samples }: any) => {
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

    it("A nested child keeps its place while its parent is interrupted", () => {
        cy.visit("?test=layout-velocity-nested")
            .wait(200)
            .get("#parent")
            .click(150, 150)
            .wait(200)
            .window()
            .then((win: any) => {
                const doc = win.document
                doc.getElementById("parent").click()
                return new Cypress.Promise<number[]>((resolve) => {
                    const offsets: number[] = []
                    const tick = () => {
                        const parent = doc
                            .getElementById("parent")
                            .getBoundingClientRect()
                        const child = doc
                            .getElementById("child")
                            .getBoundingClientRect()
                        offsets.push(child.left - parent.left)
                        offsets.length < 40
                            ? win.requestAnimationFrame(tick)
                            : resolve(offsets)
                    }
                    win.requestAnimationFrame(tick)
                })
            })
            .then((offsets: number[]) => {
                // Parent and child share one spring, so the child stays
                // 20px in from the parent's left edge.
                for (const offset of offsets) {
                    expect(Math.abs(offset - 20)).to.be.lessThan(1)
                }
            })
    })

    it("A child moving inside its parent keeps only its own velocity", () => {
        let atInterrupt = 0
        const offset = (doc: Document) =>
            doc.getElementById("child")!.getBoundingClientRect().left -
            doc.getElementById("parent")!.getBoundingClientRect().left
        cy.visit("?test=layout-velocity-nested&move")
            .wait(200)
            .get("#parent")
            .click(150, 150)
            .wait(150)
            .window()
            .then((win: any) => {
                const doc = win.document
                atInterrupt = offset(doc)
                doc.getElementById("parent").click()
                return new Cypress.Promise<number[]>((resolve) => {
                    const offsets: number[] = []
                    const tick = () => {
                        offsets.push(offset(doc))
                        offsets.length < 4
                            ? win.requestAnimationFrame(tick)
                            : resolve(offsets)
                    }
                    win.requestAnimationFrame(tick)
                })
            })
            .then((offsets: number[]) => {
                // The child keeps moving right inside its parent for a few
                // frames before it turns back.
                expect(Math.max(...offsets)).to.be.greaterThan(atInterrupt + 3)
            })
    })

    it("A layout animation that starts with no width completes", () => {
        cy.visit("?test=layout-velocity-zero-size")
            .wait(200)
            .window()
            .then((win: any) => {
                win.document.getElementById("box").click()
            })
            .wait(150)
            .window()
            .then((win: any) => {
                win.document.getElementById("box").click()
            })
            .wait(2000)
            .get("#box")
            .should(([$el]: any) => {
                expect($el.dataset.completed).to.equal("1")
                expect($el.getBoundingClientRect().width).to.equal(200)
            })
    })

    it("An interrupted spring with a delay holds still during the delay", () => {
        let atInterrupt = 0
        cy.visit("?test=layout-velocity-fixed-edge&delay")
            .wait(200)
            .get("#box")
            .click(10, 10)
            .wait(700)
            .window()
            .then((win: any) => {
                const box = win.document.getElementById("box")
                atInterrupt = box.getBoundingClientRect().width
                box.click()
                return new Cypress.Promise<number[]>((resolve) => {
                    const widths: number[] = []
                    const tick = () => {
                        widths.push(box.getBoundingClientRect().width)
                        widths.length < 10
                            ? win.requestAnimationFrame(tick)
                            : resolve(widths)
                    }
                    win.requestAnimationFrame(tick)
                })
            })
            .then((widths: number[]) => {
                // The 0.3s delay shows the box where it was interrupted,
                // not at the end of the new animation.
                for (const width of widths) {
                    expect(Math.abs(width - atInterrupt)).to.be.lessThan(2)
                }
            })
    })

    it("With mass auto, a bigger element settles later", () => {
        cy.visit("?test=layout-velocity-auto-mass")
            .wait(200)
            .get("#toggle")
            .click(10, 10)
            .wait(2500)
            .should(() => {
                const small = Number(Cypress.$("#small")[0].dataset.duration)
                const big = Number(Cypress.$("#big")[0].dataset.duration)
                // Mass 0.25 (50px) against mass 1.67 (500px).
                expect(small).to.be.greaterThan(0)
                expect(big - small).to.be.greaterThan(300)
            })
    })

    it("The default layout transition stays a tween", () => {
        cy.visit("?test=layout-velocity-auto-mass&default")
            .wait(200)
            .get("#toggle")
            .click(10, 10)
            .wait(1500)
            .should(() => {
                for (const id of ["#small", "#big"]) {
                    const duration = Number(Cypress.$(id)[0].dataset.duration)
                    expect(duration).to.be.greaterThan(0)
                    expect(duration).to.be.lessThan(530)
                }
            })
    })

    it("A layout spring with a duration ends on time", () => {
        cy.visit("?test=layout-velocity-auto-mass&duration")
            .wait(200)
            .get("#toggle")
            .click(10, 10)
            .wait(1500)
            .should(() => {
                for (const id of ["#small", "#big"]) {
                    const duration = Number(Cypress.$(id)[0].dataset.duration)
                    expect(duration).to.be.greaterThan(0)
                    expect(duration).to.be.lessThan(380)
                }
            })
    })

    it("An interrupted mirror spring goes back to where it was interrupted", () => {
        let atInterrupt = 0
        cy.visit("?test=layout-velocity-interrupt&mirror")
            .wait(200)
            .get("#box")
            .click()
            .wait(120)
            .window()
            .then((win: any) => {
                atInterrupt = leftOfBox(win.document)
                win.document.getElementById("box").click()
                return sampleFrames(win, 90)
            })
            .then((samples: number[]) => {
                // The spring reaches the left, then mirrors back to the
                // point of the interrupt and not past it.
                const left = samples.indexOf(Math.min(...samples))
                const back = Math.max(...samples.slice(left))
                expect(Math.abs(back - atInterrupt)).to.be.lessThan(5)
            })
    })
})
