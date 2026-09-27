/**
 * Two-pass FLIP (the AnimateNumber pattern): a layout effect starts one
 * animation, and a setState in an effect triggers a `layout` animation in a
 * second render. With the value change in a transition, both animations must
 * still start on the same frame.
 *
 * Page: dev/react/src/tests/start-transition-two-pass.tsx
 */
const duration = 600

describe("Concurrent React: two-pass FLIP", () => {
    for (const mode of ["transition", "useTransition"]) {
        for (const inner of ["effect", "layoutEffect"]) {
            it(`outer ${mode}, inner ${inner}: roll and width start together`, () => {
                cy.visit(
                    `?test=start-transition-two-pass&mode=${mode}&inner=${inner}`
                )
                    .get("#run")
                    .click()
                    .window({ timeout: 10000 })
                    .should((win: any) => expect(win.__done).to.equal(true))
                    .then((win: any) => {
                        const rollStart = win.__events.find(
                            (e: any) => e.type === "roll-start"
                        ).t
                        const before = win.__samples.filter(
                            (s: any) => s.t < rollStart
                        )
                        const base = before[before.length - 1].boxes
                        const digit = win.__analyze({
                            name: "digit",
                            axis: "w",
                            from: 0,
                            to: 200,
                            after: rollStart,
                        })
                        /**
                         * Both animations are linear with the same duration,
                         * so if they start on the same frame their progress
                         * matches every frame. The median difference, in ms,
                         * is how far the width animation lags the roll.
                         */
                        const lags = win.__samples
                            .filter((s: any) => s.t >= rollStart)
                            .map((s: any) => ({
                                roll: 1 - (s.boxes.roll.y - base.roll.y) / 100,
                                width: (s.boxes.digit.w - base.digit.w) / 200,
                            }))
                            .filter(
                                ({ roll, width }: any) =>
                                    roll > 0.1 && roll < 0.9 && width < 0.99
                            )
                            .map(
                                ({ roll, width }: any) =>
                                    (roll - width) * duration
                            )
                            .sort((a: number, b: number) => a - b)
                        const widthLagMs = lags[Math.floor(lags.length / 2)]

                        expect(digit.jumps).to.equal(0)
                        expect(digit.intermediateFrames).to.be.greaterThan(10)
                        expect(Math.abs(widthLagMs)).to.be.lessThan(12)
                    })
            })
        }
    }
})
