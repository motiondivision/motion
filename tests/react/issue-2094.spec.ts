/**
 * https://github.com/motiondivision/motion/issues/2094
 *
 * Rendering Reorder.Group / Reorder.Item inside <LazyMotion strict> logs the
 * "You have rendered a `motion` component within a `LazyMotion` component"
 * strict-mode warning (once for the Group and once per Item). The user cannot
 * act on it: Reorder renders `motion` internally and there is no `m` variant.
 * Reorder should render inside a strict LazyMotion without that warning.
 *
 * motion-utils only enables warning()/invariant() when a `process` global
 * exists (as under webpack/Next.js, the reporter's setup). Vite doesn't define
 * one, so we inject `process.env.NODE_ENV = "development"` before page scripts
 * run. The control case (a plain `motion.div` with `ignoreStrict`) proves the
 * warning is observable in this environment.
 */
import { expect, test } from "@playwright/test"

for (const features of ["sync", "async"]) {
    test(`Reorder inside LazyMotion strict (${features} features) logs no strict-mode warning`, async ({
        page,
    }) => {
        await page.addInitScript(() => {
            ;(window as any).process = { env: { NODE_ENV: "development" } }
        })
        const messages: string[] = []
        page.on("console", (msg) => messages.push(msg.text()))
        page.on("pageerror", (err) => messages.push(err.message))

        await page.goto(`?test=issue-2094&features=${features}`)
        await expect(page.locator("#item-2")).toBeVisible()
        await page.waitForTimeout(500)

        const strictWarnings = messages.filter((text) =>
            text.includes("within a `LazyMotion` component")
        )
        expect(strictWarnings).toEqual([])
    })
}

test("control: motion.div with ignoreStrict inside LazyMotion strict does warn", async ({
    page,
}) => {
    await page.addInitScript(() => {
        ;(window as any).process = { env: { NODE_ENV: "development" } }
    })
    const messages: string[] = []
    page.on("console", (msg) => messages.push(msg.text()))

    await page.goto("?test=issue-2094&control=true")
    await expect(page.locator("#control")).toBeVisible()
    await page.waitForTimeout(500)

    expect(
        messages.some((text) =>
            text.includes("within a `LazyMotion` component")
        )
    ).toBe(true)
})
