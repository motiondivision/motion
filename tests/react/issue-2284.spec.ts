import { expect, test } from "@playwright/test"

/**
 * Issue #2284: when a shared layoutId element also animates `scale`,
 * the element grows larger than its final size during the layout
 * animation and then snaps back to the correct size at the end.
 */
for (const mode of ["default", "linear"]) {
    test(`shared layout + scale never exceeds final size (${mode})`, async ({
        page,
    }) => {
        await page.goto(
            `/?test=issue-2284${mode === "linear" ? "&linear" : ""}`
        )
        await page.locator("#card").click()
        await page.waitForSelector("#modal")

        const widths: number[] = await page.evaluate(
            () =>
                new Promise<number[]>((resolve) => {
                    const samples: number[] = []
                    const start = performance.now()
                    const sample = () => {
                        const el = document.getElementById("modal")!
                        samples.push(el.getBoundingClientRect().width)
                        if (performance.now() - start < 3000) {
                            requestAnimationFrame(sample)
                        } else {
                            resolve(samples)
                        }
                    }
                    requestAnimationFrame(sample)
                })
        )

        const finalWidth = widths[widths.length - 1]
        // Final rendered size is the 100px box scaled by 1.5
        expect(finalWidth).toBeCloseTo(150, 0)
        const max = Math.max(...widths)
        console.log(mode, JSON.stringify(widths.map((w) => Math.round(w))))
        expect(max).toBeLessThanOrEqual(finalWidth + 1)
    })
}
