import { expect, Page, test } from "@playwright/test"

/**
 * motion/remix in a real Remix 3 app. Animations use 1s linear
 * transitions, so values measured half way through are near 0.5.
 */

async function open(page: Page, name: string) {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`/?test=${name}`)
    await page.waitForFunction(() => (window as any).rendered)
    return errors
}

const css = (page: Page, selector: string, property: string) =>
    page.$eval(
        selector,
        (element, key) => getComputedStyle(element).getPropertyValue(key),
        property
    )

const opacity = async (page: Page, selector: string) =>
    parseFloat(await css(page, selector, "opacity"))

const matrix = (page: Page, selector: string) =>
    page.$eval(selector, (element) => {
        const { a, m41, m42 } = new DOMMatrix(
            getComputedStyle(element).transform
        )
        return { scale: a, x: m41, y: m42 }
    })

const top = (page: Page, selector: string) =>
    page.$eval(selector, (element) => element.getBoundingClientRect().top)

const left = (page: Page, selector: string) =>
    page.$eval(selector, (element) => element.getBoundingClientRect().left)

const call = (page: Page, name: string, ...args: unknown[]) =>
    page.evaluate(
        ([name, args]) => (window as any)[name as string](...(args as [])),
        [name, args] as const
    )

const progress = (from: number, mid: number, to: number) =>
    (mid - from) / (to - from)

test.describe("animate", () => {
    test("animates initial to animate on mount", async ({ page }) => {
        const errors = await open(page, "animate")
        await page.waitForTimeout(500)
        const mid = await opacity(page, "#enter")
        expect(mid).toBeGreaterThan(0.2)
        expect(mid).toBeLessThan(0.8)
        await page.waitForTimeout(700)
        expect(await opacity(page, "#enter")).toBe(1)
        expect((await matrix(page, "#enter")).x).toBe(0)
        expect(errors).toEqual([])
    })

    test("animates when animate changes", async ({ page }) => {
        await open(page, "animate")
        await call(page, "toggleTarget")
        await page.waitForTimeout(500)
        const { x } = await matrix(page, "#target")
        expect(x).toBeGreaterThan(50)
        expect(x).toBeLessThan(150)
    })

    test("re-renders keep animated values", async ({ page }) => {
        await open(page, "animate")
        await page.waitForTimeout(400)
        await call(page, "rerender")
        await page.waitForTimeout(50)
        await call(page, "rerender")
        await page.waitForTimeout(50)
        expect(await opacity(page, "#rerender")).toBe(1)
        expect(await css(page, "#rerender", "color")).toBe("rgb(0, 0, 255)")
    })

    test("renders motion values in style", async ({ page }) => {
        await open(page, "animate")
        await call(page, "setX", 50)
        await page.waitForTimeout(100)
        expect((await matrix(page, "#values")).x).toBe(50)
    })

    test("whileHover and whileTap", async ({ page }) => {
        await open(page, "animate")
        await page.hover("#hover")
        await page.waitForTimeout(200)
        expect((await matrix(page, "#hover")).scale).toBeCloseTo(1.5)
        await page.mouse.down()
        await page.waitForTimeout(200)
        expect((await matrix(page, "#hover")).scale).toBeCloseTo(0.5)
        await page.mouse.up()
        await page.waitForTimeout(200)
        expect((await matrix(page, "#hover")).scale).toBeCloseTo(1.5)
        await page.mouse.move(900, 5)
        await page.waitForTimeout(200)
        expect((await matrix(page, "#hover")).scale).toBeCloseTo(1)
    })

    test("whileFocus uses the MotionConfig transition", async ({ page }) => {
        await open(page, "animate")
        await page.focus("#focus")
        await page.waitForTimeout(500)
        const { scale } = await matrix(page, "#focus")
        expect(scale).toBeGreaterThan(1.2)
        expect(scale).toBeLessThan(1.8)
    })

    test("motion() works as a mixin", async ({ page }) => {
        await open(page, "animate")
        await page.waitForTimeout(500)
        expect(await opacity(page, "#mixin")).toBe(1)
    })
})

test.describe("exit", () => {
    test("keeps the element until exit finishes", async ({ page }) => {
        const errors = await open(page, "exit")
        await call(page, "toggleExit")
        await page.waitForTimeout(500)
        const mid = await opacity(page, "#exit")
        expect(mid).toBeGreaterThan(0.2)
        expect(mid).toBeLessThan(0.8)
        await page.waitForTimeout(800)
        expect(await page.$("#exit")).toBeNull()
        expect(errors).toEqual([])
    })

    test("in AnimatePresence, re-adding during exit reuses the element", async ({
        page,
    }) => {
        await open(page, "exit")
        await page.evaluate(() => {
            const w = window as any
            w.exitNode = document.getElementById("exit")
            w.toggleExit()
        })
        await page.waitForTimeout(400)
        await call(page, "toggleExit")
        await page.waitForTimeout(1200)
        expect(
            await page.evaluate(
                () =>
                    document.getElementById("exit") === (window as any).exitNode
            )
        ).toBe(true)
        expect(await page.$$("#exit")).toHaveLength(1)
        expect(await opacity(page, "#exit")).toBe(1)
    })

    test("a parent waits for its children's exits", async ({ page }) => {
        await open(page, "exit")
        await call(page, "toggleNested")
        await page.waitForTimeout(500)
        expect(await page.$("#outer")).not.toBeNull()
        const { x } = await matrix(page, "#inner")
        expect(x).toBeGreaterThan(20)
        expect(x).toBeLessThan(80)
        await page.waitForTimeout(800)
        expect(await page.$("#outer")).toBeNull()
    })
})

test.describe("layout", () => {
    test("animates reordered elements", async ({ page }) => {
        await open(page, "layout")
        const from = await top(page, "#item-a")
        await call(page, "reverseList")
        await page.waitForTimeout(500)
        const mid = await top(page, "#item-a")
        await page.waitForTimeout(800)
        const to = await top(page, "#item-a")
        expect(to).not.toBe(from)
        const p = progress(from, mid, to)
        expect(p).toBeGreaterThan(0.2)
        expect(p).toBeLessThan(0.8)
    })

    test("layoutId animates between components", async ({ page }) => {
        await open(page, "layout")
        const from = await left(page, ".underline-one")
        await call(page, "selectTab", "one", 2)
        await page.waitForTimeout(500)
        const mid = await left(page, ".underline-one")
        await page.waitForTimeout(800)
        const to = await left(page, ".underline-one")
        const p = progress(from, mid, to)
        expect(p).toBeGreaterThan(0.2)
        expect(p).toBeLessThan(0.8)
    })

    test("LayoutGroup keeps layoutIds apart", async ({ page }) => {
        await open(page, "layout")
        const other = await left(page, ".underline-two")
        await call(page, "selectTab", "one", 1)
        await page.waitForTimeout(500)
        expect(await page.$$(".underline-two")).toHaveLength(1)
        expect(await left(page, ".underline-two")).toBe(other)
    })
})

test.describe("drag", () => {
    async function drag(page: Page, selector: string, dx: number, dy: number) {
        await page.$eval(selector, (element) =>
            element.scrollIntoView({ block: "center" })
        )
        const box = (await page.locator(selector).boundingBox())!
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10)
            await page.waitForTimeout(16)
        }
    }

    test("drags on both axes", async ({ page }) => {
        await open(page, "drag")
        await drag(page, "#drag", 100, 50)
        await page.mouse.up()
        await page.waitForTimeout(100)
        const { x, y } = await matrix(page, "#drag")
        expect(Math.abs(x - 100)).toBeLessThan(15)
        expect(Math.abs(y - 50)).toBeLessThan(15)
    })

    test("drag='x', whileDrag and onDragEnd", async ({ page }) => {
        await open(page, "drag")
        await drag(page, "#drag-x", 80, 80)
        await page.waitForTimeout(200)
        const dragging = await matrix(page, "#drag-x")
        expect(dragging.scale).toBeCloseTo(0.8, 1)
        expect(Math.abs(dragging.x - 80)).toBeLessThan(10)
        expect(dragging.y).toBe(0)
        await page.mouse.up()
        await page.waitForTimeout(300)
        expect((await matrix(page, "#drag-x")).scale).toBeCloseTo(1, 1)
        expect(await page.evaluate(() => (window as any).dragEnded)).toBe(true)
    })
})

test.describe("variants", () => {
    test("stagger children and onAnimationComplete", async ({ page }) => {
        await open(page, "variants")
        await page.waitForTimeout(1000)
        expect(await opacity(page, "#item-0")).toBeGreaterThan(0.8)
        const second = await opacity(page, "#item-1")
        expect(second).toBeGreaterThan(0.3)
        expect(second).toBeLessThan(0.75)
        await page.waitForTimeout(1000)
        expect(await page.evaluate(() => (window as any).events)).toContain(
            "complete visible"
        )
    })

    test("whileHover labels reach children", async ({ page }) => {
        await open(page, "variants")
        await page.waitForTimeout(1600)
        await page.hover("#list")
        await page.waitForTimeout(300)
        expect((await matrix(page, "#item-1")).scale).toBeCloseTo(1.2)
    })
})

test("scopeMotion runs inside its element", async ({ page }) => {
    await open(page, "scope")
    await page.waitForTimeout(700)
    const [first, second] = await page.$$eval("#scope li", (elements) =>
        elements.map((element) => parseFloat(getComputedStyle(element).opacity))
    )
    expect(first).toBeGreaterThan(second)
    expect(second).toBeGreaterThan(0)
})

test.describe("svg", () => {
    test("animates attributes, pathLength and transforms", async ({ page }) => {
        const errors = await open(page, "svg")
        await page.waitForTimeout(500)
        const cx = parseFloat((await page.getAttribute("#circle", "cx"))!)
        expect(cx).toBeGreaterThan(20)
        expect(cx).toBeLessThan(80)
        expect(await page.getAttribute("#path", "pathLength")).toBe("1")
        const dash = (await page.getAttribute("#path", "stroke-dasharray"))!
        const drawn = parseFloat(dash)
        expect(drawn).toBeGreaterThan(0.2)
        expect(drawn).toBeLessThan(0.8)
        const svgOpacity = await opacity(page, "#svg")
        expect(svgOpacity).toBeGreaterThan(0.2)
        expect(svgOpacity).toBeLessThan(0.8)
        await page.waitForTimeout(700)
        expect(await page.getAttribute("#circle", "cx")).toBe("100")
        expect(await css(page, "#rect", "transform-box")).toBe("fill-box")
        expect(await css(page, "#rect", "transform")).toContain("matrix")
        expect(errors).toEqual([])
    })
})

test("motion values as SVG attributes and text", async ({ page }) => {
    await open(page, "svg")
    expect(await page.getAttribute("#mv-circle", "cx")).toBe("20")
    expect(await page.textContent("#mv-text")).toBe("0")
    await call(page, "setMotionValues", 60, 5)
    await page.waitForTimeout(100)
    expect(await page.getAttribute("#mv-circle", "cx")).toBe("60")
    expect(await page.textContent("#mv-text")).toBe("5")
})

test.describe("AnimatePresence", () => {
    test("initial={false} skips the first initial", async ({ page }) => {
        await open(page, "presence")
        expect(await opacity(page, "#no-initial")).toBe(1)
    })

    test("mode='wait' enters after the exit", async ({ page }) => {
        await open(page, "presence")
        await page.waitForTimeout(600)
        await call(page, "waitSwap")
        await page.waitForTimeout(250)
        expect(await page.$("#wait-a")).not.toBeNull()
        expect(await page.$("#wait-b")).toBeNull()
        await page.waitForTimeout(500)
        expect(await page.$("#wait-a")).toBeNull()
        expect(await page.$("#wait-b")).not.toBeNull()
        expect(await page.evaluate(() => (window as any).waitExited)).toBe(1)
    })

    test("mode='popLayout' moves siblings at once", async ({ page }) => {
        await open(page, "presence")
        const from = await top(page, "#pop-b")
        const target = await top(page, "#pop-a")
        await call(page, "popFirst")
        await page.waitForTimeout(500)
        expect(await css(page, "#pop-a", "position")).toBe("absolute")
        const mid = await top(page, "#pop-b")
        const p = progress(from, mid, target)
        expect(p).toBeGreaterThan(0.2)
        expect(p).toBeLessThan(0.8)
        await page.waitForTimeout(800)
        expect(await page.$("#pop-a")).toBeNull()
    })

    test("custom replaces the exiting element's custom", async ({ page }) => {
        await open(page, "presence")
        await call(page, "exitCustom", -1)
        await page.waitForTimeout(500)
        const { x } = await matrix(page, "#custom")
        expect(x).toBeLessThan(-20)
        expect(x).toBeGreaterThan(-80)
    })
})

test.describe("server rendering", () => {
    test("renders initial values, then hydrates and animates", async ({
        page,
    }) => {
        const errors: string[] = []
        page.on("pageerror", (error) => errors.push(error.message))
        await page.goto("/ssr.html?test=ssr")

        expect(await opacity(page, "#box")).toBe(0)
        expect((await matrix(page, "#box")).x).toBe(-100)
        expect(await opacity(page, "#item")).toBe(0)
        expect(await page.getAttribute("#path", "stroke-dasharray")).toBe("0 1")

        await page.evaluate(() => (window as any).hydrate())
        await page.waitForFunction(() => (window as any).rendered)
        await page.waitForTimeout(500)
        const mid = await opacity(page, "#box")
        expect(mid).toBeGreaterThan(0.2)
        expect(mid).toBeLessThan(0.8)
        expect(await page.$$("#box")).toHaveLength(1)

        await page.waitForTimeout(700)
        expect(await opacity(page, "#box")).toBe(1)
        expect(await opacity(page, "#item")).toBe(1)
        expect(errors).toEqual([])
    })
})

test.describe("regressions", () => {
    test("AnimatePresence keeps a removed plain element until the motion elements inside it exit", async ({
        page,
    }) => {
        const errors = await open(page, "regressions")
        await call(page, "hideNested")
        await page.waitForTimeout(500)
        expect(await page.$("#nested-wrapper")).not.toBeNull()
        const mid = await opacity(page, "#nested-exit")
        expect(mid).toBeGreaterThan(0.2)
        expect(mid).toBeLessThan(0.8)
        await page.waitForTimeout(800)
        expect(await page.$("#nested-wrapper")).toBeNull()
        expect(errors).toEqual([])
    })

    test("a parent's variant change uses the children's new transition", async ({
        page,
    }) => {
        await open(page, "regressions")
        expect(await opacity(page, "#variant-child")).toBe(0)
        // Opening has a 0.5s delay, so the child hasn't started at 0.3s.
        await call(page, "toggleVariant")
        await page.waitForTimeout(300)
        expect(await opacity(page, "#variant-child")).toBe(0)
        await page.waitForTimeout(1500)
        expect(await opacity(page, "#variant-child")).toBe(1)
        // Closing has no delay.
        await call(page, "toggleVariant")
        await page.waitForTimeout(300)
        expect(await opacity(page, "#variant-child")).toBeLessThan(0.9)
    })

    test("children added later stagger from the start of their group", async ({
        page,
    }) => {
        await open(page, "regressions")
        await page.waitForTimeout(1200)
        await call(page, "addItems")
        // The first new child has no delay; with the old entering set it
        // waited 2 x 0.5s.
        await page.waitForTimeout(350)
        expect(await opacity(page, "#entering-2")).toBe(1)
    })

    test("a layout animation uses this render's transition", async ({
        page,
    }) => {
        await open(page, "regressions")
        const from = await left(page, "#layout-transition")
        await call(page, "toggleLayout")
        await page.waitForTimeout(500)
        const mid = await left(page, "#layout-transition")
        const p = progress(from, mid, from + 300)
        expect(p).toBeGreaterThan(0.2)
        expect(p).toBeLessThan(0.8)
    })

    test("an exiting layoutId element hands over to its replacement", async ({
        page,
    }) => {
        const errors = await open(page, "regressions")
        await call(page, "closeShared")
        await page.waitForTimeout(500)
        // The button grows from the menu's size, so it's visible and
        // between 50 and 250px wide half way.
        const width = await page.$eval(
            "#shared-button",
            (element) => element.getBoundingClientRect().width
        )
        expect(width).toBeGreaterThan(80)
        expect(width).toBeLessThan(220)
        expect(await opacity(page, "#shared-button")).toBeGreaterThan(0.2)
        await page.waitForTimeout(800)
        expect(await page.$("#shared-menu")).toBeNull()
        expect(errors).toEqual([])
    })

    test("drag and tap set React's host styles", async ({ page }) => {
        await open(page, "regressions")
        expect(await css(page, "#drag-x", "touch-action")).toBe("pan-y")
        expect(await css(page, "#drag-x", "user-select")).toBe("none")
        expect(await page.getAttribute("#drag-x", "tabindex")).toBe("0")
        expect(await page.getAttribute("#drag-x", "draggable")).toBe("false")
    })
})

test("an inherited value that didn't change for one label animates on the next", async ({
    page,
}) => {
    await open(page, "regressions")
    await call(page, "startInherited")
    await page.waitForTimeout(1200)
    expect(await opacity(page, "#inherited")).toBe(1)
})

test("drag turned on after mount", async ({ page }) => {
    const errors = await open(page, "regressions")
    await call(page, "enableDrag")
    await page.waitForTimeout(100)
    const box = (await page.$("#drag-later"))!
    await box.scrollIntoViewIfNeeded()
    const { x, y, width, height } = (await box.boundingBox())!
    await page.mouse.move(x + width / 2, y + height / 2)
    await page.mouse.down()
    await page.mouse.move(x + width / 2 + 50, y + height / 2, { steps: 10 })
    await page.mouse.up()
    expect((await matrix(page, "#drag-later")).x).toBeGreaterThan(30)
    expect(errors).toEqual([])
})
