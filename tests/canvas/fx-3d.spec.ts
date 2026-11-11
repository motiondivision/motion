import { expect, test } from "@playwright/test"

/**
 * <motion-fx perspective="400"> is at the page's top-left, 400 x 300 CSS
 * pixels. #card is a red button, 100 x 60, in its centre: (150, 120) to
 * (250, 180). #front (blue) and #behind (green) are 100 x 60 at
 * (150, 20), with #behind later in the DOM.
 */
const red = [255, 0, 0, 255]

const set = (page: any, selector: string, values: object) =>
    page.evaluate(
        async ([selector, values]: [string, object]) => {
            const w = window as any
            await w.animate(selector, values, { duration: 0 })
            // The jump is motion blurred for one frame
            await w.nextRender()
            await w.nextRender()
        },
        [selector, values]
    )

const at = (page: any, points: number[][]) =>
    page.evaluate(async (points: number[][]) => {
        const px = await (window as any).nextRender()
        return points.map(([x, y]) => px.at(x, y))
    }, points)

test.describe("<motion-fx> perspective", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("canvas/fx-3d.html")
        await page.waitForFunction(() => (window as any).ready)
    })

    test("z moves a child towards the camera", async ({ page }) => {
        // 400 / (400 - 200) = 2, so it's drawn 200 x 120
        await set(page, "#card", { z: 200 })
        const [inside, edge, outside] = await at(page, [
            [200 + 90, 150],
            [200, 150 + 55],
            [200 + 110, 150],
        ])
        expect(inside).toEqual(red)
        expect(edge).toEqual(red)
        expect(outside[3]).toBe(0)
    })

    test("rotateY turns a child, with its far side smaller", async ({
        page,
    }) => {
        /**
         * The sides are at x = 25 from the centre and z = 43.3 behind
         * and in front of it. They're drawn 22.6px and 28px from the
         * centre, and 54px and 67px tall.
         */
        await set(page, "#card", { rotateY: 60 })
        const [nearSide, farSide, flatSide, tall, short] = await at(page, [
            [200 + 20, 150],
            [200 - 20, 150],
            [200 + 35, 150],
            [200 - 24, 150 - 31],
            [200 + 20, 150 - 31],
        ])
        expect(nearSide).toEqual(red)
        expect(farSide).toEqual(red)
        expect(flatSide[3]).toBe(0)
        // rotateY(60deg) brings the left side towards the camera
        expect(tall).toEqual(red)
        expect(short[3]).toBe(0)
    })

    test("rotateX turns a child around its horizontal axis", async ({
        page,
    }) => {
        // The top and bottom are 15px from the centre before perspective
        await set(page, "#card", { rotateX: 60 })
        const [inside, outside] = await at(page, [
            [200, 150 + 10],
            [200, 150 + 22],
        ])
        expect(inside).toEqual(red)
        expect(outside[3]).toBe(0)
    })

    test("a real click hits a turned child where it's drawn", async ({
        page,
    }) => {
        await set(page, "#card", { rotateY: 60 })
        await page.mouse.click(200 + 20, 150)
        expect(await page.evaluate(() => (window as any).clicks)).toBe(1)
        await page.mouse.click(200 + 38, 150)
        expect(await page.evaluate(() => (window as any).clicks)).toBe(1)
    })

    test("draws the child that's nearer the camera on top", async ({
        page,
    }) => {
        // #behind is later in the DOM, so it's on top until it moves back
        const [before] = await at(page, [[200, 50]])
        expect(before).toEqual([0, 255, 0, 255])

        await set(page, "#behind", { z: -100 })
        const [after] = await at(page, [[200, 50]])
        expect(after).toEqual([0, 0, 255, 255])
    })

    test("hit testing follows the depth order", async ({ page }) => {
        await page.mouse.click(200, 50)
        await set(page, "#behind", { z: -100 })
        await page.mouse.click(200, 50)
        expect(await page.evaluate(() => (window as any).hits)).toEqual([
            "behind",
            "front",
        ])
    })

    test("a child with a group moves with that child", async ({ page }) => {
        const yellow = [255, 255, 0, 255]
        // #moon's centre is 80px to the right of #pivot
        const [start] = await at(page, [[280, 150]])
        expect(start).toEqual(yellow)

        await set(page, "#pivot", { rotate: 90 })
        const [left, below] = await at(page, [
            [280, 150],
            [200, 230],
        ])
        expect(left[3]).toBe(0)
        expect(below).toEqual(yellow)

        // Half a turn around the vertical axis, and towards the camera
        await set(page, "#pivot", { rotate: 0, rotateY: 180, z: 200 })
        const [near, edge, outside] = await at(page, [
            [200 - 160, 150],
            [200 - 160 - 35, 150 + 35],
            [200 - 160 + 45, 150],
        ])
        expect(near).toEqual(yellow)
        expect(edge).toEqual(yellow)
        expect(outside[3]).toBe(0)
    })

    test("pinch() scales a child in the canvas", async ({ page }) => {
        const cdp = await page.context().newCDPSession(page)
        const touch = (type: string, xs: number[]) =>
            cdp.send("Input.dispatchTouchEvent", {
                type: type as "touchStart",
                touchPoints: xs.map((x, id) => ({ x, y: 150, id })),
            })
        await touch("touchStart", [180, 220])
        await at(page, [])
        for (let i = 1; i <= 5; i++) {
            await touch("touchMove", [180 - i * 4, 220 + i * 4])
            await at(page, [])
        }
        // The touches are twice as far apart, so it's drawn 200 x 120
        await at(page, [])
        const [inside, edge, outside] = await at(page, [
            [200 - 90, 150],
            [200, 150 + 55],
            [200 - 110, 150],
        ])
        await touch("touchEnd", [])
        expect(inside).toEqual(red)
        expect(edge).toEqual(red)
        expect(outside[3]).toBe(0)
    })

    test("a child's CSS transform is its base pose", async ({ page }) => {
        const cyan = [0, 255, 255, 255]
        const [topLeft, bottomRight, outside] = await at(page, [
            [35, 215],
            [105, 285],
            [25, 250],
        ])
        expect(topLeft).toEqual(cyan)
        expect(bottomRight).toEqual(cyan)
        expect(outside[3]).toBe(0)

        // Hit testing is where it's drawn, not where its layout box is
        await page.mouse.click(100, 280)
        expect(await page.evaluate(() => (window as any).hits)).toEqual(["css"])

        // Motion's values move it from there
        await set(page, "#css", { x: 100 })
        const [moved, left] = await at(page, [
            [205, 285],
            [105, 285],
        ])
        expect(moved).toEqual(cyan)
        expect(left[3]).toBe(0)
    })

    test("reads the perspective from CSS", async ({ page }) => {
        await page.evaluate(async () => {
            const w = window as any
            w.host.removeAttribute("perspective")
            await w.nextRender()
        })
        await set(page, "#card", { z: 100 })
        // No perspective: z does nothing
        const [flat] = await at(page, [[200 - 60, 150]])
        expect(flat[3]).toBe(0)

        await page.evaluate(async () => {
            const w = window as any
            w.host.style.perspective = "200px"
            // A new layout is when the element reads its styles again
            w.host.style.height = "301px"
            for (let i = 0; i < 4; i++) await w.nextRender()
        })
        // 200 / (200 - 100) = 2
        const [inside] = await at(page, [[200 - 90, 150]])
        expect(inside).toEqual(red)
    })

    test("layer.origin is where the canvas is in a larger scene", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const w = window as any
            w.host.shaders = [w.flat()]
            for (let i = 0; i < 6; i++) await w.nextRender()
        })
        const [inside, outside] = await at(page, [
            [200 + 45, 150],
            [200 + 55, 150],
        ])
        expect(inside).toEqual(red)
        expect(outside[3]).toBe(0)
    })

    test("project() puts a mesh in front of the same camera", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const w = window as any
            w.host.shaders = [w.far()]
            for (let i = 0; i < 6; i++) await w.nextRender()
        })
        // Half size around the centre: the card is at 175-225, 135-165
        const [inside, outside] = await at(page, [
            [200 + 20, 150],
            [200 + 27, 150],
        ])
        expect(inside).toEqual(red)
        expect(outside[3]).toBe(0)
    })
})

test.describe("<motion-fx> 3D as normal DOM", () => {
    const frames = (page: any) =>
        page.evaluate(
            () =>
                new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                )
        )
    const centre = (page: any, selector: string) =>
        page.evaluate((selector: string) => {
            const box = document.querySelector(selector)!.getBoundingClientRect()
            return [
                Math.round(box.left + box.width / 2),
                Math.round(box.top + box.height / 2),
            ]
        }, selector)

    test.beforeEach(async ({ page }) => {
        await page.goto("canvas/fx-3d.html?noshim")
        await page.waitForFunction(() => (window as any).ready)
    })

    test("a child follows its group", async ({ page }) => {
        expect(await centre(page, "#moon")).toEqual([280, 150])
        await page.evaluate(() =>
            (window as any).animate("#pivot", { rotate: 90 }, { duration: 0 })
        )
        await frames(page)
        expect(await centre(page, "#moon")).toEqual([200, 230])

        // Each change starts again from the child's own transform
        await page.evaluate(() =>
            (window as any).animate("#pivot", { rotate: 180 }, { duration: 0 })
        )
        await frames(page)
        expect(await centre(page, "#moon")).toEqual([120, 150])
    })

    test("canvasEffect() binds to the style", async ({ page }) => {
        await page.evaluate(() => {
            const w = window as any
            w.canvasEffect(document.getElementById("card"), {
                x: w.motionValue(50),
            })
        })
        await frames(page)
        expect(await centre(page, "#card")).toEqual([250, 150])
    })

    test(":state(drawing) only matches while the canvas draws", async ({
        page,
    }) => {
        const matches = () =>
            page.evaluate(() =>
                document.querySelector("motion-fx")!.matches(":state(drawing)")
            )
        expect(await matches()).toBe(false)
        await page.goto("canvas/fx-3d.html")
        await page.waitForFunction(() => (window as any).ready)
        expect(await matches()).toBe(true)
    })
})
