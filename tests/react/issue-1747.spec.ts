/**
 * https://github.com/motiondivision/motion/issues/1747
 *
 * A short fast flick on a draggable element that is at a standstill should
 * hand the inertia animation a release velocity matching the flick, just as
 * the same flick does while a previous inertia animation is still running.
 *
 * Currently, from a standstill the release velocity collapses to ~0 (the
 * pan history's pointer-down point is stamped with the stale frameData
 * timestamp from the last frame before the frameloop went idle), so the
 * element appears to decelerate abruptly as soon as the finger lifts.
 *
 * The flick: pointerdown, wait ~16ms, one 80px move up, release. That is
 * >1000px/s, so a correct release velocity is well below -500px/s.
 */
import { CDPSession, expect, Page, test } from "@playwright/test"

type Input = "mouse" | "touch"

async function pointer(
    page: Page,
    cdp: CDPSession | null,
    type: "down" | "move" | "up",
    x: number,
    y: number
) {
    if (cdp) {
        await cdp.send("Input.dispatchTouchEvent", {
            type:
                type === "down"
                    ? "touchStart"
                    : type === "move"
                    ? "touchMove"
                    : "touchEnd",
            touchPoints: type === "up" ? [] : [{ x, y }],
        })
    } else if (type === "down") {
        await page.mouse.move(x, y)
        await page.mouse.down()
    } else if (type === "move") {
        await page.mouse.move(x, y)
    } else {
        await page.mouse.up()
    }
}

async function flick(
    page: Page,
    cdp: CDPSession | null,
    steps: number,
    dist: number
) {
    const before = await page.evaluate(() => window.__moves.length)
    let y = 500
    await pointer(page, cdp, "down", 150, y)
    for (let i = 0; i < steps; i++) {
        await page.waitForTimeout(16)
        y -= dist
        await pointer(page, cdp, "move", 150, y)
    }
    await pointer(page, cdp, "up", 150, y)
    await page.waitForTimeout(50)

    return page.evaluate((before) => {
        const moves = window.__moves.slice(before)
        const first = moves[0] // pointerdown
        const last = moves[moves.length - 1]
        return {
            actual: ((last.y - first.y) / (last.t - first.t)) * 1000,
            reported: window.__dragEnd[window.__dragEnd.length - 1].velocity,
        }
    }, before)
}

async function setup(page: Page, input: Input) {
    await page.goto("?test=issue-1747")
    await expect(page.locator("#box")).toBeVisible()
    const cdp =
        input === "touch" ? await page.context().newCDPSession(page) : null
    // Let the frameloop go fully idle
    await page.waitForTimeout(500)
    return cdp
}

for (const input of ["mouse", "touch"] as Input[]) {
    test.describe(`issue #1747 (${input})`, () => {
        test("control: fast flick while inertia is animating", async ({
            page,
        }) => {
            const cdp = await setup(page, input)
            await flick(page, cdp, 4, 30)
            // Flick again while the first flick's inertia is still running
            await page.waitForTimeout(100)
            const { actual, reported } = await flick(page, cdp, 1, 80)
            console.log(input, "animating", { actual, reported })
            expect(reported).toBeLessThan(-500)
        })

        test("fast flick from a standstill", async ({ page }) => {
            const cdp = await setup(page, input)
            const { actual, reported } = await flick(page, cdp, 1, 80)
            console.log(input, "standstill", { actual, reported })
            expect(reported).toBeLessThan(-500)
        })
    })
}
