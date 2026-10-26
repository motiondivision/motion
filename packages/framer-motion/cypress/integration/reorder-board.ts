interface Point {
    x: number
    y: number
}

/**
 * Pointer events at viewport points. Moves and releases go to the body: a
 * dragged item moved to another group is a new element, and the gesture
 * listens on the window.
 */
function pointer(el: Element, type: string, { x, y }: Point) {
    const win = el.ownerDocument.defaultView as any
    el.dispatchEvent(
        new win.PointerEvent(type, {
            clientX: x,
            clientY: y,
            isPrimary: true,
            bubbles: true,
            pointerId: 1,
            button: 0,
            pointerType: "mouse",
        })
    )
}

function key(el: Element, key: string) {
    const win = el.ownerDocument.defaultView as any
    el.dispatchEvent(
        new win.KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
        })
    )
}

const centre = (el: Element): Point => {
    const { left, top, width, height } = el.getBoundingClientRect()
    return { x: left + width / 2, y: top + height / 2 }
}

const scale = (el: Element) => {
    const { transform } = getComputedStyle(el)
    if (transform === "none") return 1
    const [a, b] = transform.match(/-?[\d.e]+/g)!.map(Number)
    return Math.hypot(a, b)
}

const item = (id: string) => cy.get(`[data-testid='${id}']`)

/**
 * Move the pointer to `to` in `steps`, a frame at a time.
 */
function moveTo(from: Point, to: Point, steps: number) {
    for (let i = 1; i <= steps; i++) {
        cy.get("body")
            .then(([body]) => {
                pointer(body, "pointermove", {
                    x: from.x + ((to.x - from.x) * i) / steps,
                    y: from.y + ((to.y - from.y) * i) / steps,
                })
            })
            .nextFrame()
    }
}

describe("Reorder.Board", () => {
    beforeEach(() => {
        cy.visit("?test=reorder-board").wait(200)
        item("a").nextFrame().nextFrame()
    })

    it("drags an item into another group and carries on dragging it there", () => {
        let start: Point
        let target: Point

        item("d").then(([d]) => {
            const { x, y } = centre(d)
            // Just below d's centre: past d, before e
            target = { x, y: y + 15 }
        })
        item("a")
            .then(([a]) => {
                start = centre(a)
                pointer(a, "pointerdown", start)
            })
            .then(() => moveTo(start, { x: start.x + 10, y: target.y }, 2))
            // Let whileDrag finish
            .wait(400)
        item("a").should(([a]) => {
            expect(scale(a)).to.be.closeTo(1.2, 0.01)
        })

        cy.wrap(null).then(() =>
            moveTo({ x: start.x + 10, y: target.y }, target, 10)
        )

        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:b,c doing:d,a,e done:"
        )
        item("a").then(([a]) => {
            expect(a.parentElement!.dataset.testid).to.equal("doing")
            // Under the pointer, as dragged so far, rather than in its slot
            const { x, y } = centre(a)
            expect(x).to.be.closeTo(target.x, 3)
            expect(y).to.be.closeTo(target.y, 3)
            // Without whileDrag starting over
            expect(scale(a)).to.be.closeTo(1.2, 0.02)
        })

        // It carries on reordering in its new group, past e
        cy.wrap(null).then(() =>
            moveTo(target, { x: target.x, y: target.y + 96 }, 8)
        )
        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:b,c doing:d,e,a done:"
        )

        cy.get("body").then(([body]) =>
            pointer(body, "pointerup", { x: target.x, y: target.y + 96 })
        )

        // It settles into its slot, and its drag ends once
        item("e").then(([e]) => {
            const slot = e.getBoundingClientRect().top + 60
            item("a").should(([a]) => {
                expect(a.getBoundingClientRect().top).to.be.closeTo(slot, 1)
                expect(scale(a)).to.equal(1)
            })
        })
        cy.get("[data-testid='drags']").should("have.text", "1,1")
    })

    it("drags an item into an empty group", () => {
        let start: Point
        let target: Point

        cy.get("[data-testid='done']").then(([done]) => {
            const { left, top, width } = done.getBoundingClientRect()
            target = { x: left + width / 2, y: top + 40 }
        })
        item("c")
            .then(([c]) => {
                start = centre(c)
                pointer(c, "pointerdown", start)
            })
            .then(() => moveTo(start, target, 12))

        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:a,b doing:d,e done:c"
        )
        cy.get("body").then(([body]) => pointer(body, "pointerup", target))

        cy.get("[data-testid='done']").then(([done]) => {
            const slot = done.getBoundingClientRect().top + 10
            item("c").should(([c]) => {
                expect(c.getBoundingClientRect().top).to.be.closeTo(slot, 1)
            })
        })
        cy.get("[data-testid='drags']").should("have.text", "1,1")
    })

    it("moves a grabbed item between groups with the arrow keys", () => {
        item("b").then(([b]) => {
            ;(b as HTMLElement).focus()
            key(b, " ")
        })
        item("b").then(([b]) => key(b, "ArrowRight"))
        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:a,c doing:d,b,e done:"
        )

        // Focus and the grab follow it
        item("b").then(([b]) => {
            expect(b.ownerDocument.activeElement).to.equal(b)
            key(b, "ArrowDown")
        })
        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:a,c doing:d,e,b done:"
        )

        item("b").then(([b]) => key(b, "ArrowRight"))
        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:a,c doing:d,e done:b"
        )

        // Escape returns it to where it was grabbed
        item("b").then(([b]) => key(b, "Escape"))
        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:a,b,c doing:d,e done:"
        )
        item("b").then(([b]) => {
            expect(b.ownerDocument.activeElement).to.equal(b)
        })
        cy.get("[data-testid='drags']").should("have.text", "0,0")
    })
})

describe("Reorder.Board in a scrolling board", () => {
    beforeEach(() => {
        cy.visit("?test=reorder-board&overflow").wait(200)
        item("a").nextFrame().nextFrame()
    })

    it("scrolls the board, not the item's column, to reach a column out of view", () => {
        let start: Point
        let edge: Point

        cy.get("[data-testid='board']").then(([board]) => {
            edge = { x: board.getBoundingClientRect().right - 20, y: 0 }
        })
        item("a")
            .then(([a]) => {
                start = centre(a)
                edge.y = start.y
                pointer(a, "pointerdown", start)
            })
            .then(() => moveTo(start, edge, 10))

        // Held by its edge, the board scrolls across to its end, passing
        // "done" under the item on the way
        cy.get("[data-testid='board']").should(([board]) => {
            expect(board.scrollLeft).to.be.closeTo(
                board.scrollWidth - board.clientWidth,
                1
            )
        })
        cy.get("[data-testid='state']").should(
            "have.text",
            "todo:b,c doing:d,e done:a"
        )

        // The columns, which scroll down, don't scroll across
        cy.get("[data-testid='board'] > div").then((columns) => {
            expect(
                columns.toArray().map((column) => column.scrollLeft)
            ).to.deep.equal([0, 0, 0])
        })

        cy.get("body").then(([body]) => pointer(body, "pointerup", edge))
        cy.get("[data-testid='done']").then(([done]) => {
            const slot = done.getBoundingClientRect().top + 10
            item("a").should(([a]) => {
                expect(a.getBoundingClientRect().top).to.be.closeTo(slot, 1)
            })
        })
        cy.get("[data-testid='drags']").should("have.text", "1,1")
    })
})
