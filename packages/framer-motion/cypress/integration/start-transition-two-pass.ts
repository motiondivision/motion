/**
 * Two-pass FLIP (the AnimateNumber pattern): a layout effect starts one
 * animation (the digit roll), and a setState in an effect triggers a `layout`
 * width animation in a second render. Both must start on the same frame:
 * no frame may be painted between the roll starting and the width
 * animation starting (onLayoutAnimationStart).
 *
 * This checks frames, not milliseconds: on a slow machine the JS between the
 * two starts can take tens of ms without anything being painted in between.
 *
 * Page: dev/react/src/tests/start-transition-two-pass.tsx
 *
 * Known limitation, skipped unless run with `--env known=1`:
 *
 * - inner useEffect (any outer mode): a setState inside useEffect is a
 *   normal-priority update that React schedules as a separate task, not in
 *   the commit's task, so the browser can paint a frame between the roll
 *   starting and the width animation starting. Seen locally for an urgent
 *   click (one frame) and on CI with transitions (React 19), where the
 *   passive effects themselves also run after paint. The two animations then
 *   run a frame or more out of phase. This is React scheduling, not Motion:
 *   a second pass that must start on the same frame belongs in
 *   useLayoutEffect, whose update is synchronous (tested below for sync,
 *   startTransition and useTransition outer updates).
 */
const cases = [
    ["sync", "layoutEffect"],
    ["transition", "layoutEffect"],
    ["useTransition", "layoutEffect"],
    ["sync", "effect"],
    ["transition", "effect"],
    ["useTransition", "effect"],
]

const knownLimitations = [
    "sync effect",
    "transition effect",
    "useTransition effect",
]
const test = (key: string) =>
    knownLimitations.includes(key) && !Cypress.env("known") ? it.skip : it

const event = (win: any, type: string) =>
    win.__events.find((e: any) => e.type === type)

/**
 * The width animation, measured from the width the page recorded as the
 * roll started (samples may begin mid-animation when frames are slow).
 */
const analyzeWidth = (win: any) => {
    const start = event(win, "roll-start")
    return win.__analyze({
        name: "digit",
        axis: "w",
        from: 0,
        to: 200,
        after: start.t,
        startValue: start.data.w,
    })
}

describe("Concurrent React: two-pass FLIP", () => {
    for (const [mode, inner] of cases) {
        test(`${mode} ${inner}`)(
            `outer ${mode}, inner ${inner}: roll and width start on the same frame`,
            () => {
                cy.visit(
                    `?test=start-transition-two-pass&mode=${mode}&inner=${inner}`
                )
                    .nextFrame()
                    .nextFrame()
                    .get("#run")
                    .click()
                    .window({ timeout: 60000 })
                    .should((win: any) => expect(win.__done).to.equal(true))
                    // Re-queried until the width animation has finished
                    .should((win: any) => {
                        expect(event(win, "roll-start")).to.exist
                        expect(event(win, "width-start")).to.exist
                        expect(analyzeWidth(win).finalProgress).to.be.closeTo(
                            1,
                            0.01
                        )
                    })
                    .then((win: any) => {
                        const rollStart = event(win, "roll-start").t
                        const widthStart = event(win, "width-start").t
                        const framesBetween = win.__samples.filter(
                            (s: any) => s.t > rollStart && s.t < widthStart
                        ).length
                        expect(framesBetween).to.equal(0)

                        const width = analyzeWidth(win)
                        expect(width.jumps).to.equal(0)
                        expect(width.animatedMs).to.be.greaterThan(250)
                    })
            }
        )
    }
})
