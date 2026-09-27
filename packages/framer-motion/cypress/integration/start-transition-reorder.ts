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
 * - once: Reorder.Group clears its `isReordering` guard in a dependency-less
 *   useEffect, so an unrelated commit (useTransition's isPending render, the
 *   stale render in front of a deferred value) re-enables onReorder before
 *   the pending order commits, calling it again with the same order. Fixed by
 *   https://github.com/motiondivision/motion/pull/3854, which adds its own
 *   regression test (reorder-transition.ts); un-skip these once it lands.
 */
const modes = ["transition", "useTransition", "deferred"]

const knownLimitations = [
    "drop transition",
    "drop useTransition",
    "drop deferred",
    "once useTransition",
    "once deferred",
]
const test = (key: string) =>
    knownLimitations.includes(key) && !Cypress.env("known") ? it.skip : it

/**
 * Per frame during the drag: the largest distance between the dragged item
 * and where the pointer says it should be.
 */
function maxPointerDrift(win: any) {
    const down = win.__events.find((e: any) => e.type === "pointerdown")
    const up = win.__events.find((e: any) => e.type === "pointerup")
    const first = win.__samples.find(
        (s: any) => s.t < down.t && s.boxes["item-0"]
    )
    const grab = down.data.y - first.boxes["item-0"].y
    let maxDrift = 0
    for (const s of win.__samples) {
        if (s.t <= down.t || s.t >= up.t) continue
        const moves = win.__pointer.filter((p: any) => p.t <= s.t)
        if (!moves.length) continue
        const pointerY = moves[moves.length - 1].y
        maxDrift = Math.max(
            maxDrift,
            Math.abs(s.boxes["item-0"].y - (pointerY - grab))
        )
    }
    return maxDrift
}

function drag(mode: string) {
    return cy
        .visit(`?test=start-transition-reorder&mode=${mode}&slowCount=30`)
        .get("#run")
        .click()
        .window({ timeout: 10000 })
        .should((win: any) => expect(win.__done).to.equal(true))
        .then((win: any) => {
            const commits = win.__events
                .filter(
                    (e: any) => e.type === "commit" && e.data.label === "items"
                )
                .map((e: any) => e.data.value)
            const els = Array.from(
                win.document.querySelectorAll("[data-track^=item-]")
            ) as HTMLElement[]
            return {
                drift: maxPointerDrift(win),
                reorders: win.__events
                    .filter((e: any) => e.type === "onReorder")
                    .map((e: any) => e.data),
                finalOrder: commits[commits.length - 1],
                domOrder: els.map((el) => el.id.slice(5)).join(""),
                tops: els.map((el) => el.getBoundingClientRect().top),
            }
        })
}

describe("Concurrent React: Reorder", () => {
    for (const mode of modes) {
        it(`drag (${mode}) keeps the item under the pointer and settles stacked`, () => {
            drag(mode).then((r: any) => {
                expect(r.drift).to.be.lessThan(30)
                expect(r.domOrder).to.equal(r.finalOrder)
                for (let i = 1; i < r.tops.length; i++) {
                    expect(r.tops[i] - r.tops[i - 1]).to.be.closeTo(60, 1)
                }
            })
        })

        test(`drop ${mode}`)(
            `drag (${mode}) drops the item in the slot under the pointer`,
            () => {
                drag(mode).then((r: any) => {
                    expect(r.finalOrder).to.equal("123045")
                })
            }
        )

        test(`once ${mode}`)(
            `drag (${mode}) calls onReorder once per new order`,
            () => {
                drag(mode).then((r: any) => {
                    for (let i = 1; i < r.reorders.length; i++) {
                        expect(r.reorders[i]).not.to.equal(r.reorders[i - 1])
                    }
                })
            }
        )
    }
})
