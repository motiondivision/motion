import { expect, Page, test } from "@playwright/test"

/**
 * Motion components from the core entry fetch the layout and drag features
 * when their props first need them. These hold the feature files back, so
 * they arrive after the components have mounted.
 */

/**
 * The dev server marks the files Motion fetches itself, as a page that
 * imports all of Motion also loads them with the page.
 */
const featureFile = /motion\/features\/(layout|drag)\.mjs\?lazy/

/**
 * Open a page with its feature files held until release() is called.
 */
async function open(page: Page, query: string) {
    let release!: VoidFunction
    const held = new Promise<void>((resolve) => (release = resolve))
    let requested = 0

    await page.route(featureFile, async (route) => {
        requested++
        await held
        await route.continue()
    })

    await page.goto(`async.html?${query}`)
    await page.waitForSelector("#root > *")

    return {
        requested: () => requested,
        /**
         * Let the features load, and the components take them up.
         */
        arrive: async () => {
            const loaded = page.waitForResponse(featureFile)
            release()
            await loaded
            await page.waitForTimeout(200)
        },
    }
}

const rect = (page: Page, id: string) =>
    page.evaluate((id) => {
        const { x, y, width, height } = document
            .getElementById(id)!
            .getBoundingClientRect()
        return { x, y, width, height }
    }, id)

const opacity = (page: Page, id: string) =>
    page.evaluate(
        (id) => getComputedStyle(document.getElementById(id)!).opacity,
        id
    )

for (const strict of ["", "&strict"]) {
    test.describe(`async layout and drag features${
        strict && ", strict mode"
    }`, () => {
        test.use({ viewport: { width: 1000, height: 800 } })

        test("a layout change after the feature arrives animates", async ({
            page,
        }) => {
            const features = await open(page, "case=layout" + strict)
            expect(features.requested()).toBeGreaterThan(0)
            await features.arrive()

            await page.click("#toggle")
            await page.waitForTimeout(1000)

            const { width } = await rect(page, "box")
            expect(width).toBeGreaterThan(110)
            expect(width).toBeLessThan(220)
        })

        test("a layout change before the feature arrives is applied without it", async ({
            page,
        }) => {
            const features = await open(page, "case=layout" + strict)

            await page.click("#toggle")
            await page.waitForTimeout(100)
            expect((await rect(page, "box")).width).toBe(400)

            /**
             * The feature's arrival doesn't animate a change already made.
             */
            await features.arrive()
            expect((await rect(page, "box")).width).toBe(400)

            await page.click("#toggle")
            await page.waitForTimeout(1000)
            const { width } = await rect(page, "box")
            expect(width).toBeGreaterThan(280)
            expect(width).toBeLessThan(390)
        })

        test("an element holds its exit for a layout animation after the feature arrived mid-exit", async ({
            page,
        }) => {
            const features = await open(page, "case=presence" + strict)

            /**
             * Exit, with the feature arriving while the modal fades.
             */
            await page.click("#toggle")
            await page.waitForTimeout(100)
            await features.arrive()
            await expect(page.locator("#modal")).toHaveCount(1)

            /**
             * Enter again before it's removed, and let it settle.
             */
            await page.click("#toggle")
            await page.waitForTimeout(2500)
            await expect(page.locator("#modal")).toHaveCount(1)
            expect((await rect(page, "modal")).width).toBe(300)

            /**
             * Now only the shared layout animation holds its exit.
             */
            await page.click("#no-exit")
            await page.click("#toggle")
            await page.waitForTimeout(1000)
            await expect(page.locator("#modal")).toHaveCount(1)
            const { width, x } = await rect(page, "modal")
            expect(width).toBeGreaterThan(120)
            expect(width).toBeLessThan(280)
            expect(x).toBeGreaterThan(20)
            expect(x).toBeLessThan(280)

            await page.waitForTimeout(1500)
            await expect(page.locator("#modal")).toHaveCount(0)
        })

        test("elements that share a layoutId don't animate when the feature arrives", async ({
            page,
        }) => {
            /**
             * What the same elements do with the features bundled. Not in
             * strict mode, where its second mount makes one take over
             * from the other, which a production build doesn't do.
             */
            await page.goto("async.html?case=shared&impl=sync")
            await page.waitForSelector("#a")
            await page.waitForTimeout(300)
            const expected = {
                a: await rect(page, "a"),
                b: await rect(page, "b"),
                aOpacity: await opacity(page, "a"),
                bOpacity: await opacity(page, "b"),
            }

            const features = await open(page, "case=shared" + strict)
            await features.arrive()

            const read = async () => ({
                a: await rect(page, "a"),
                b: await rect(page, "b"),
                aOpacity: await opacity(page, "a"),
                bOpacity: await opacity(page, "b"),
            })

            expect(await read()).toEqual(expected)
            await page.waitForTimeout(500)
            expect(await read()).toEqual(expected)
        })

        test("features that arrive while their elements are hidden work once shown", async ({
            page,
        }) => {
            const features = await open(page, "case=hidden" + strict)

            await page.click("#hide")
            await page.waitForTimeout(100)
            await features.arrive()
            await page.click("#hide")
            await page.waitForTimeout(200)

            /**
             * Layout animates.
             */
            await page.click("#toggle")
            await page.waitForTimeout(1000)
            const { width } = await rect(page, "box")
            expect(width).toBeGreaterThan(110)
            expect(width).toBeLessThan(220)

            /**
             * Drag follows the pointer.
             */
            const before = await rect(page, "drag")
            await page.mouse.move(before.x + 50, before.y + 50)
            await page.mouse.down()
            await page.mouse.move(before.x + 70, before.y + 70, { steps: 4 })
            await page.mouse.move(before.x + 150, before.y + 90, { steps: 8 })
            await page.mouse.up()
            await page.waitForTimeout(100)
            const after = await rect(page, "drag")
            expect(after.x - before.x).toBeGreaterThan(80)
            expect(after.y - before.y).toBeGreaterThan(20)
        })
    })
}
