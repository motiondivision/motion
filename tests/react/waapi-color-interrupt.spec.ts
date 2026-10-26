/**
 * Found while investigating https://github.com/motiondivision/motion/issues/2369
 *
 * backgroundColor used to run on WAAPI, where the browser interpolates it in
 * sRGB with premultiplied alpha. When it was interrupted, Motion estimated
 * the current colour from a JS copy of the animation, which mixes colours in
 * linear space, so the new animation started from a different colour to the
 * one on screen and the colour visibly jumped.
 *
 * The page records the rendered colour every frame. A jump shows up as one
 * frame-to-frame change far faster than the frames either side of it.
 */
import { expect, test } from "@playwright/test"

type Frame = [number, string]

/**
 * Premultiplied [r, g, b, a], all 0-255, of a computed rgb()/rgba() colour.
 */
function premultiplied(color: string) {
    const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number)
    return [r * a, g * a, b * a, a * 255]
}

const cases = [
    { from: "rgb(255, 0, 0)", to: "rgb(0, 0, 255)" },
    { from: "rgba(255, 0, 0, 0.2)", to: "rgb(0, 0, 255)" },
]

test.describe("backgroundColor animation interrupted midway", () => {
    for (const { from, to } of cases) {
        test(`${from} -> ${to} continues from the rendered colour`, async ({
            page,
        }) => {
            await page.goto(
                `?test=waapi-color-interrupt&from=${encodeURIComponent(
                    from
                )}&to=${encodeURIComponent(to)}`
            )
            await expect(page.locator("#box")).toBeVisible()
            await page.waitForTimeout(2100)

            const frames: Frame[] = await page.evaluate(
                () => window.colorFrames
            )
            expect(frames.length).toBeGreaterThan(20)

            const values = frames.map(([, color]) => premultiplied(color))

            /**
             * Check the animation was actually interrupted partway: blue
             * rose, then returned to the start colour.
             */
            const blues = values.map(([, , blue]) => blue)
            const peak = Math.max(...blues)
            expect(peak).toBeGreaterThan(60)
            expect(peak).toBeLessThan(220)
            expect(blues[blues.length - 1]).toBe(0)

            /**
             * The fastest any channel changes per ms between each pair of
             * frames. A jump is a step several times faster than the steps
             * either side of it. Linear-space mixing is steep near its
             * endpoints, so only look at steps around the interrupt.
             */
            const interruptedAt: number = await page.evaluate(
                () => window.interruptedAt
            )
            const rates = values.slice(1).map((value, i) => {
                const elapsed = frames[i + 1][0] - frames[i][0]
                let rate = 0
                for (let c = 0; c < 4; c++) {
                    const delta = Math.abs(value[c] - values[i][c])
                    rate = Math.max(rate, delta / elapsed)
                }
                return rate
            })

            const jumps: string[] = []
            let checked = 0
            for (let i = 1; i < rates.length - 1; i++) {
                const t = frames[i + 1][0] - interruptedAt
                if (t < -50 || t > 150) continue
                checked++
                const neighbours = Math.max(rates[i - 1], rates[i + 1])
                if (rates[i] > 3 * neighbours + 0.3) {
                    jumps.push(`${frames[i][1]} -> ${frames[i + 1][1]}`)
                }
            }

            expect(checked).toBeGreaterThan(3)
            expect(jumps).toEqual([])
        })
    }
})
