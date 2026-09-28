/**
 * Reorder with onReorder in startTransition / useTransition, or values from
 * useDeferredValue, with ~300ms item renders (slowCount=30). The drag itself
 * runs on motion values, so the item must stay under the pointer however
 * late the order commits.
 *
 * Page: dev/react/src/tests/start-transition-reorder.tsx
 *
 * Known limitations, skipped unless run with `--env known=1`:
 *
 * - drop: each reorder commits late, and Reorder only re-checks the order on
 *   pointermove while no reorder is pending, so the drop lands short of the
 *   pointer's slot ("120345" instead of "123045"). Apps should keep
 *   onReorder urgent.
 *
 * "calls onReorder once per new order" is the concurrent-mode regression test
 * for #3854 (see also reorder-transition.ts).
 */
const modes = ["transition", "useTransition", "deferred"]

const knownLimitations = [
    "drop transition",
    "drop useTransition",
    "drop deferred",
]
const test = (key: string) =>
    knownLimitations.includes(key) && !Cypress.env("known") ? it.skip : it

/**
 * Per frame during the drag: the largest distance between the dragged item
 * and where the pointer says it should be. The grab offset is measured by the
 * page at pointerdown, so this doesn't depend on when frames are sampled.
 */
function pointerDrift(win: any) {
    const down = win.__events.find((e: any) => e.type === "pointerdown")
    const up = win.__events.find((e: any) => e.type === "pointerup")
    let maxDrift = 0
    let frames = 0
    for (const s of win.__samples) {
        if (s.t <= down.t || s.t >= up.t) continue
        const moves = win.__pointer.filter((p: any) => p.t <= s.t)
        if (!moves.length) continue
        const pointerY = moves[moves.length - 1].y
        frames++
        maxDrift = Math.max(
            maxDrift,
            Math.abs(s.boxes["item-0"].y - (pointerY - down.data.grab))
        )
    }
    return { maxDrift, frames }
}

const committedOrder = (win: any) =>
    win.__events
        .filter((e: any) => e.type === "commit" && e.data.label === "items")
        .map((e: any) => e.data.value)
        .pop()

function drag(mode: string) {
    return cy
        .visit(`?test=start-transition-reorder&mode=${mode}&slowCount=30`)
        .nextFrame()
        .nextFrame()
        .get("#run")
        .click()
        .window({ timeout: 15000 })
        .should((win: any) => expect(win.__done).to.equal(true))
}

describe("Concurrent React: Reorder", () => {
    for (const mode of modes) {
        it(`drag (${mode}) keeps the item under the pointer and settles stacked`, () => {
            drag(mode).then((win: any) => {
                const { maxDrift, frames } = pointerDrift(win)
                expect(frames).to.be.greaterThan(5)
                expect(maxDrift).to.be.lessThan(30)
            })
            // Re-queried until the drop animation and any pending order settle
            cy.window().should((win: any) => {
                const els = Array.from(
                    win.document.querySelectorAll("[data-track^=item-]")
                ) as HTMLElement[]
                expect(els.map((el) => el.id.slice(5)).join("")).to.equal(
                    committedOrder(win)
                )
                const tops = els.map((el) => el.getBoundingClientRect().top)
                for (let i = 1; i < tops.length; i++) {
                    expect(tops[i] - tops[i - 1]).to.be.closeTo(60, 1)
                }
            })
        })

        test(`drop ${mode}`)(
            `drag (${mode}) drops the item in the slot under the pointer`,
            () => {
                drag(mode)
                cy.window().should((win: any) =>
                    expect(committedOrder(win)).to.equal("123045")
                )
            }
        )

        it(`drag (${mode}) calls onReorder once per new order`, () => {
            drag(mode).then((win: any) => {
                const reorders = win.__events
                    .filter((e: any) => e.type === "onReorder")
                    .map((e: any) => e.data)
                expect(reorders.length).to.be.greaterThan(0)
                for (let i = 1; i < reorders.length; i++) {
                    expect(reorders[i]).not.to.equal(reorders[i - 1])
                }
            })
        })
    }
})
