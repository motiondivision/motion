import { expect, Page, test } from "@playwright/test"

/**
 * htmlPlane in Chromium's HTML-in-canvas origin trial build, through the
 * dev shim that maps the shipped API onto it. Runs in the html-in-canvas
 * project, which launches Chromium with the trial flag.
 */

type Point = [number, number]

async function load(page: Page) {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("three/html-plane.html")
    await page.waitForFunction(() => (window as any).ready)
    expect(await page.evaluate(() => (window as any).test.support)).toBe(
        "trial"
    )

    /**
     * The first paint has uploaded the card: its white background is drawn.
     */
    await page.waitForFunction(() => {
        const { HTMLPlaneTest: h, test: t } = window as any
        const [x, y] = h.project(t.card, t.camera, 150, 190)
        return h.pixel(t.renderer, x, y)[0] > 200
    })

    return errors
}

const frames = (page: Page, count = 3) =>
    page.evaluate(async (count) => {
        for (let i = 0; i < count; i++) {
            await (window as any).HTMLPlaneTest.nextFrame()
        }
    }, count)

/**
 * Turns a plane with a spring and waits for it to land.
 */
async function rotate(page: Page, plane: "card" | "form", y: number) {
    await page.evaluate(
        async ([plane, y]) => {
            const { HTMLPlaneTest: h, test: t } = window as any
            await h.animate(
                t[plane].rotation,
                { y },
                { type: "spring", visualDuration: 0.3, bounce: 0 }
            )
        },
        [plane, y] as const
    )
    await frames(page)
}

/**
 * Where three.js draws a point of a plane's element, given in CSS pixels
 * from its top-left.
 */
const project = (page: Page, plane: "card" | "form", x: number, y: number) =>
    page.evaluate(
        ([plane, x, y]) => {
            const { HTMLPlaneTest: h, test: t } = window as any
            return h.project(t[plane], t.camera, x, y) as Point
        },
        [plane, x, y] as const
    )

/**
 * The centre of an element inside a plane's element, in CSS pixels from
 * the plane element's top-left. Offsets ignore CSS transforms.
 */
const centreOf = (page: Page, plane: "card" | "form", selector: string) =>
    page.evaluate(
        ([plane, selector]) => {
            const root = (window as any).test[plane].element as HTMLElement
            const el = document.querySelector(selector) as HTMLElement
            return [
                el.offsetLeft - root.offsetLeft + el.offsetWidth / 2,
                el.offsetTop - root.offsetTop + el.offsetHeight / 2,
            ] as Point
        },
        [plane, selector] as const
    )

const pixel = (page: Page, [x, y]: Point) =>
    page.evaluate(
        ([x, y]) => {
            const { HTMLPlaneTest: h, test: t } = window as any
            return h.pixel(t.renderer, x, y) as number[]
        },
        [x, y] as const
    )

function expectColour(actual: number[], expected: number[], tolerance = 8) {
    for (let i = 0; i < 3; i++) {
        expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance)
    }
}

/**
 * Dark pixels across the label, sampled on a grid through the plane.
 */
const labelSignature = (page: Page) =>
    page.evaluate(() => {
        const { HTMLPlaneTest: h, test: t } = window as any
        let signature = ""
        let dark = 0
        for (let y = 20; y < 62; y += 3) {
            for (let x = 16; x < 220; x += 3) {
                const [px, py] = h.project(t.card, t.camera, x, y)
                const isDark = h.pixel(t.renderer, px, py)[0] < 100
                signature += isDark ? "1" : "0"
                dark += isDark ? 1 : 0
            }
        }
        return { signature, dark }
    })

test.describe("htmlPlane with the HTML-in-canvas trial", () => {
    test("draws the live element on a rotated plane", async ({ page }) => {
        const errors = await load(page)

        /**
         * Flat, the plane matches the element: the right way up, and in
         * the same colours.
         */
        const swatch = await centreOf(page, "card", "#swatch")
        /**
         * Left of the button's label.
         */
        const [bx, by] = await centreOf(page, "card", "#button")
        const button: Point = [bx - 45, by]
        expectColour(
            await pixel(page, await project(page, "card", ...swatch)),
            [128, 128, 128]
        )
        expectColour(
            await pixel(page, await project(page, "card", ...button)),
            [0, 0, 255]
        )

        const flatEdge = await project(page, "card", 296, 100)
        expectColour(await pixel(page, flatEdge), [255, 255, 255])

        await rotate(page, "card", 0.61)

        expectColour(
            await pixel(page, await project(page, "card", ...swatch)),
            [128, 128, 128]
        )
        expectColour(
            await pixel(page, await project(page, "card", ...button)),
            [0, 0, 255]
        )

        /**
         * The far edge turned away from where the flat card was.
         */
        expectColour(await pixel(page, flatEdge), [0, 0, 0])

        /**
         * The texture follows the element's text.
         */
        const before = await labelSignature(page)
        expect(before.dark).toBeGreaterThan(20)

        await page.evaluate(() => {
            document.getElementById("label")!.textContent = "Motion"
        })
        await expect
            .poll(async () => (await labelSignature(page)).signature)
            .not.toBe(before.signature)

        const after = await labelSignature(page)
        expect(after.dark).toBeGreaterThan(20)
        expect(errors).toEqual([])
    })

    test("takes real clicks and typing through perspective", async ({
        page,
    }) => {
        const errors = await load(page)

        await rotate(page, "card", 0.61)
        await rotate(page, "form", -0.61)

        const button = await project(
            page,
            "card",
            ...(await centreOf(page, "card", "#button"))
        )
        expect(
            await page.evaluate(
                ([x, y]) => document.elementFromPoint(x, y)?.id,
                button
            )
        ).toBe("button")

        await page.mouse.click(...button)
        expect(
            await page.evaluate(() => (window as any).test.presses.length)
        ).toBe(1)

        const input = await project(
            page,
            "form",
            ...(await centreOf(page, "form", "#input"))
        )
        await page.mouse.click(...input)
        expect(await page.evaluate(() => document.activeElement?.id)).toBe(
            "input"
        )

        await page.keyboard.type("hello from 3D")
        expect(await page.locator("#input").inputValue()).toBe("hello from 3D")
        expect(errors).toEqual([])
    })

    test("places the element over its projected quad", async ({ page }) => {
        await load(page)
        await rotate(page, "card", 0.61)

        const bounds = async (corners: Point[]) => {
            const xs = corners.map(([x]) => x)
            const ys = corners.map(([, y]) => y)
            return {
                left: Math.min(...xs),
                top: Math.min(...ys),
                right: Math.max(...xs),
                bottom: Math.max(...ys),
            }
        }

        const rect = (selector: string) =>
            page.evaluate((selector) => {
                const r = document
                    .querySelector(selector)!
                    .getBoundingClientRect()
                return {
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                }
            }, selector)

        const expectBounds = (actual: any, expected: any) => {
            for (const side of ["left", "top", "right", "bottom"]) {
                expect(
                    Math.abs(actual[side] - expected[side])
                ).toBeLessThanOrEqual(1)
            }
        }

        expectBounds(
            await rect("#card"),
            await bounds([
                await project(page, "card", 0, 0),
                await project(page, "card", 300, 0),
                await project(page, "card", 300, 200),
                await project(page, "card", 0, 200),
            ])
        )

        const [cx, cy] = await centreOf(page, "card", "#button")
        expectBounds(
            await rect("#button"),
            await bounds([
                await project(page, "card", cx - 60, cy - 22),
                await project(page, "card", cx + 60, cy - 22),
                await project(page, "card", cx + 60, cy + 22),
                await project(page, "card", cx - 60, cy + 22),
            ])
        )
    })

    test("stops hit testing when the plane isn't drawn", async ({ page }) => {
        await load(page)
        await rotate(page, "card", 0.61)

        const button = await project(
            page,
            "card",
            ...(await centreOf(page, "card", "#button"))
        )
        const hit = () =>
            page.evaluate(
                ([x, y]) => document.elementFromPoint(x, y)?.id,
                button
            )
        expect(await hit()).toBe("button")

        await page.evaluate(() => ((window as any).test.card.visible = false))
        await frames(page)
        expect(await hit()).not.toBe("button")

        await page.evaluate(() => ((window as any).test.card.visible = true))
        await frames(page)
        expect(await hit()).toBe("button")

        /**
         * Behind the camera.
         */
        await page.evaluate(() => {
            const { card, camera } = (window as any).test
            card.position.z = camera.position.z + 200
        })
        await frames(page)
        expect(await hit()).not.toBe("button")

        /**
         * Disposed: the element goes back where it came from.
         */
        await page.evaluate(() => (window as any).test.card.dispose())
        expect(
            await page.evaluate(
                () => document.getElementById("card")!.parentElement!.tagName
            )
        ).toBe("MAIN")
    })
})
