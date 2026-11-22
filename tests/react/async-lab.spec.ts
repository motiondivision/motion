import { expect, Page, test } from "@playwright/test"

/**
 * dev/react-19/async-lab.html is a page to watch, by eye, what happens
 * to enter animations that run as CSS when something interrupts them.
 * These run its scenarios with the animation code held back, so each
 * interruption comes before or after it arrives.
 */

const animationFile = /animation\/appear\/animations\.mjs/

async function open(page: Page, scenario: string, hold = true) {
    let release: VoidFunction = () => {}

    if (hold) {
        const held = new Promise<void>((resolve) => (release = resolve))
        await page.route(animationFile, async (route) => {
            await held
            await route.continue()
        })
    }

    await page.addInitScript((scenario) => {
        localStorage.setItem("lab-scenario", scenario)
        localStorage.setItem("lab-delay", "0")
        localStorage.setItem("lab-interrupt", "0")
    }, scenario)
    await page.goto("async-lab.html")
    await page.waitForSelector("#interrupt-now")

    return async () => {
        const loaded = page.waitForResponse(animationFile)
        release()
        await loaded
        await page.waitForTimeout(200)
    }
}

const interrupt = (page: Page) => page.click("#interrupt-now")

const read = (page: Page, id: string) =>
    page.evaluate((id) => {
        const element = document.getElementById(id)
        if (!element) return undefined

        const animations = element.getAnimations()
        const css = animations.filter(
            (animation) => "animationName" in animation
        ).length

        return {
            x: element.getBoundingClientRect().x,
            width: element.getBoundingClientRect().width,
            opacity: parseFloat(getComputedStyle(element).opacity),
            css,
            other: animations.length - css,
            inline: element.style.animation,
            transform: getComputedStyle(element).transform,
        }
    }, id)

test.describe("async lab", () => {
    test("a layout animation runs beside a CSS enter animation", async ({
        page,
    }) => {
        const arrive = await open(page, "Layout animation interrupts enter")
        await page.waitForTimeout(500)

        const before = (await read(page, "layout-opacity"))!
        expect(before.css).toBe(1)
        expect(before.x).toBe(24)

        // The layout code is there, the animation code isn't
        await interrupt(page)
        await page.waitForTimeout(500)

        const during = (await read(page, "layout-opacity"))!
        expect(during.css).toBe(1)
        expect(during.opacity).toBeGreaterThan(before.opacity + 0.1)
        expect(during.x).toBeGreaterThan(50)
        expect(during.x).toBeLessThan(400)

        // A child with a CSS transform, in a parent that animates layout
        const child = (await read(page, "layout-child"))!
        expect(child.css).toBe(3)

        await arrive()
        const after = (await read(page, "layout-opacity"))!
        expect(after.css).toBe(1)
        expect(after.opacity).toBeGreaterThan(during.opacity)
        expect(after.x).toBeGreaterThan(during.x)

        await page.waitForTimeout(3500)
        const end = (await read(page, "layout-opacity"))!
        expect(end.css + end.other).toBe(0)
        expect(end.opacity).toBe(1)
        expect(end.x).toBeGreaterThan(700)
        expect(end.width).toBe(200)

        const childEnd = (await read(page, "layout-child"))!
        expect(childEnd.css + childEnd.other).toBe(0)
        expect(childEnd.width).toBe(60)
    })

    test("an element that takes over a layoutId has no enter animation", async ({
        page,
    }) => {
        const arrive = await open(page, "Layout animation interrupts enter")
        await page.waitForTimeout(500)
        expect((await read(page, "layout-shared"))!.css).toBe(1)

        await interrupt(page)
        await page.waitForTimeout(300)

        // It moves from where the other was
        const shared = (await read(page, "layout-shared"))!
        expect(shared.css).toBe(0)
        expect(shared.x).toBeLessThan(400)

        await arrive()
        await page.waitForTimeout(3500)
        const end = (await read(page, "layout-shared"))!
        expect(end.css + end.other).toBe(0)
        expect(end.opacity).toBe(1)
        expect(end.x).toBeGreaterThan(700)
    })

    test("an exit before the animation code waits for it", async ({ page }) => {
        const arrive = await open(page, "Exit during enter")
        await page.waitForTimeout(500)
        const before = (await read(page, "exit"))!

        await interrupt(page)
        await page.waitForTimeout(500)

        // The element stays, and its enter animation carries on
        const waiting = (await read(page, "exit"))!
        expect(waiting.css).toBe(3)
        expect(waiting.opacity).toBeGreaterThan(before.opacity)

        // The exit starts from what the element shows
        await arrive()
        const exiting = (await read(page, "exit"))!
        expect(exiting.css).toBe(0)
        expect(exiting.opacity).toBeGreaterThan(waiting.opacity - 0.15)
        expect(exiting.opacity).toBeLessThan(waiting.opacity + 0.1)
        expect(exiting.x).toBeGreaterThan(waiting.x - 1)

        await page.waitForTimeout(500)
        const later = (await read(page, "exit"))!
        expect(later.opacity).toBeLessThan(exiting.opacity)
        expect(later.x).toBeGreaterThan(exiting.x)

        await page.waitForTimeout(3000)
        expect(await read(page, "exit")).toBe(undefined)
    })

    test("a reordered element keeps its place in its enter animation", async ({
        page,
    }) => {
        const arrive = await open(page, "Reorder")
        await page.waitForTimeout(1000)
        const before = (await read(page, "reorder-One"))!
        expect(before.css).toBe(1)

        // The browser makes the animations of a moved element again
        await interrupt(page)
        await page.waitForTimeout(300)
        const moved = (await read(page, "reorder-One"))!
        expect(moved.css).toBe(1)
        expect(moved.opacity).toBeGreaterThan(before.opacity + 0.05)

        await arrive()
        expect((await read(page, "reorder-One"))!.opacity).toBeGreaterThan(
            moved.opacity
        )

        await page.waitForTimeout(2500)
        for (const item of ["One", "Two", "Three", "Four"]) {
            const end = (await read(page, "reorder-" + item))!
            expect(end.css + end.other).toBe(0)
            expect(end.inline).toBe("")
            expect(end.opacity).toBe(1)
        }
    })

    test("a target that changes back before the animation code is honoured", async ({
        page,
    }) => {
        const arrive = await open(page, "Staggered variants")
        await page.waitForTimeout(300)

        // Shown, then hidden again
        await interrupt(page)
        await arrive()
        await page.waitForTimeout(1500)

        const end = (await read(page, "stagger"))!
        expect(end.css + end.other).toBe(0)
        expect(end.opacity).toBe(0)
    })

    test("children that take a parent's variants stagger as CSS", async ({
        page,
    }) => {
        const warnings: string[] = []
        page.on("console", (message) => warnings.push(message.text()))

        const arrive = await open(page, "Staggered variants")
        await page.waitForTimeout(450)

        // 0.2 s apart: the last has yet to start
        const first = (await read(page, "stagger-0"))!
        const second = (await read(page, "stagger-1"))!
        const last = (await read(page, "stagger-3"))!
        expect(first.css).toBeGreaterThan(0)
        expect(last.css).toBeGreaterThan(0)
        expect(first.opacity).toBeGreaterThan(second.opacity)
        expect(second.opacity).toBeGreaterThan(0)
        expect(last.opacity).toBe(0)

        // The animation code leaves them to run
        await arrive()
        for (const index of [0, 1, 2, 3]) {
            const child = (await read(page, "stagger-" + index))!
            expect(child.css).toBeGreaterThan(0)
            expect(child.other).toBe(0)
        }

        await page.waitForTimeout(2500)
        for (const index of [0, 1, 2, 3]) {
            const child = (await read(page, "stagger-" + index))!
            expect(child.css + child.other).toBe(0)
            expect(child.inline).toBe("")
            expect(child.opacity).toBe(1)
            expect(child.transform).toBe("none")
        }

        expect(
            warnings.filter((text) => text.includes("can't run as CSS"))
        ).toEqual([])
    })

    test("the animation code takes a CSS transform over for a layout animation", async ({
        page,
    }) => {
        const arrive = await open(page, "Layout animation interrupts enter")
        await page.waitForTimeout(500)

        // x is a CSS animation: translate, and a hold of transform
        const before = (await read(page, "layout-x"))!
        expect(before.css).toBe(3)
        expect(before.x).toBeGreaterThan(-170)
        expect(before.x).toBeLessThan(-100)

        // Layout moves an element with its transform, so the animation
        // code carries x on from where it was. Opacity stays as CSS.
        await arrive()
        const taken = (await read(page, "layout-x"))!
        expect(taken.css).toBe(1)
        expect(taken.x).toBeGreaterThan(before.x)
        expect(taken.x).toBeLessThan(before.x + 60)

        await interrupt(page)
        await page.waitForTimeout(100)

        // On its way to the new place, from where it was
        const during = (await read(page, "layout-x"))!
        expect(during.css).toBe(1)
        expect(during.x).toBeGreaterThan(taken.x)
        expect(during.x).toBeLessThan(taken.x + 150)
        expect(during.opacity).toBeGreaterThan(before.opacity)

        await page.waitForTimeout(3500)
        const end = (await read(page, "layout-x"))!
        expect(end.css + end.other).toBe(0)
        expect(end.inline).toBe("")
        expect(end.opacity).toBe(1)
        expect(end.x).toBeGreaterThan(700)
    })

    test("a new target starts from what the element shows", async ({
        page,
    }) => {
        const arrive = await open(page, "Target changes during enter")
        await page.waitForTimeout(500)
        await interrupt(page)
        await page.waitForTimeout(500)

        // CSS still plays the animation it mounted with
        const before = (await read(page, "target-variants"))!
        expect(before.css).toBe(3)

        await arrive()
        const after = (await read(page, "target-variants"))!
        expect(after.css).toBe(0)
        expect(after.x).toBeGreaterThan(before.x - 1)
        expect(after.x).toBeLessThan(before.x + 80)

        await page.waitForTimeout(3500)
        const end = (await read(page, "target-variants"))!
        expect(end.x).toBe(324)
        expect(end.opacity).toBe(0.5)
        expect((await read(page, "target-x"))!.x).toBe(324)
        expect((await read(page, "target-spring"))!.css).toBe(0)
    })

    test("animation controls started at mount don't wait for the animation code", async ({
        page,
    }) => {
        await open(page, "Controls and useAnimate")
        await page.waitForTimeout(1000)

        const controls = (await read(page, "controls"))!
        expect(controls.opacity).toBeGreaterThan(0.2)
        expect(controls.x).toBeGreaterThan(-250)
    })

    test("gestures and a drag work during and after an enter animation", async ({
        page,
    }) => {
        const arrive = await open(page, "Gestures during enter")
        await page.waitForTimeout(300)
        await arrive()

        const box = (await page.locator("#drag").boundingBox())!
        await page.mouse.move(box.x + 50, box.y + 50)
        await page.mouse.down()
        await page.mouse.move(box.x + 150, box.y + 50, { steps: 10 })
        const dragged = (await read(page, "drag"))!
        await page.mouse.up()

        // The drag moved it, and the opacity enter animation carried on
        expect(dragged.x).toBeGreaterThan(box.x + 50)
        expect(dragged.css).toBe(1)
    })
})
