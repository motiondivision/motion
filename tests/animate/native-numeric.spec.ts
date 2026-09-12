import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
    await page.goto("animate/native-numeric.html")
    await page.waitForFunction(() => Boolean((window as any).Motion))
})

test("native numeric values preserve interpolation, endpoints and MotionValue types", async ({
    page,
}) => {
    const results = await page.evaluate(async () => {
        const { animate } = (window as any).Motion
        const frame = () => new Promise(requestAnimationFrame)
        const properties = [
            "width",
            "height",
            "borderRadius",
            "borderTopLeftRadius",
            "borderTopRightRadius",
            "borderBottomLeftRadius",
            "borderBottomRightRadius",
        ]
        const cases = properties.map((property) => ({
            property,
            from: 20 as string | number,
            to: 40 as string | number,
            midpoint: "30px",
        }))
        cases.push(
            { property: "width", from: "20px", to: "40px", midpoint: "30px" },
            {
                property: "borderRadius",
                from: "20%",
                to: "40%",
                midpoint: "30%",
            },
            {
                property: "width",
                from: "var(--from)",
                to: "var(--to)",
                midpoint: "60px",
            }
        )
        const samples = []
        for (const spec of cases) {
            const box = document.createElement("div")
            box.className = "box"
            box.style.setProperty("--from", "20%")
            box.style.setProperty("--to", "40%")
            document.querySelector("#container")!.append(box)
            const controls = animate(
                box,
                { [spec.property]: [spec.from, spec.to] },
                { autoplay: false, duration: 1, ease: "linear" }
            )
            for (let i = 0; i < 3; i++) await frame()
            const native = box.getAnimations().length
            controls.time = 0.5
            await frame()
            const actual = getComputedStyle(box)[spec.property as any]
            controls.complete()
            await controls
            for (let i = 0; i < 3; i++) await frame()
            const final = box.style[spec.property as any]
            // The native bridge must not convert a user's numeric MotionValue
            // into a CSS string just because WAAPI requires pixel units.
            const finalValue =
                controls.animations[0].animation.options.motionValue.get()
            samples.push({
                ...spec,
                native,
                actual,
                final,
                finalValue,
                remaining: box.getAnimations().length,
            })
            box.remove()
        }
        return samples
    })
    for (const result of results) {
        expect(result.native, result.property).toBe(1)
        expect(result.actual, result.property).toBe(result.midpoint)
        expect(result.final).toBe(
            typeof result.to === "number" ? result.to + "px" : result.to
        )
        expect(result.finalValue).toBe(result.to)
        expect(result.remaining).toBe(0)
    }
})

test("stopping numeric native animation preserves its rendered position and numeric value", async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const { animate } = (window as any).Motion
        const frame = () => new Promise(requestAnimationFrame)
        const box = document.createElement("div")
        box.className = "box"
        document.querySelector("#container")!.append(box)
        const controls = animate(
            box,
            { width: [100, 200] },
            { duration: 2, ease: "linear" }
        )
        for (let i = 0; i < 15; i++) await frame()
        const native = box.getAnimations().length
        const before = parseFloat(getComputedStyle(box).width)
        controls.stop()
        for (let i = 0; i < 3; i++) await frame()
        const after = parseFloat(getComputedStyle(box).width)
        const value = controls.animations[0].animation.options.motionValue.get()
        for (let i = 0; i < 3; i++) await frame()
        return {
            native,
            before,
            after,
            value,
            settled: parseFloat(getComputedStyle(box).width),
            remaining: box.getAnimations().length,
        }
    })
    expect(result.native).toBe(1)
    expect(result.before).toBeGreaterThan(100)
    expect(result.before).toBeLessThan(200)
    expect(Math.abs(result.after - result.before)).toBeLessThan(2)
    expect(typeof result.value).toBe("number")
    expect(Math.abs(result.value - result.after)).toBeLessThan(0.1)
    expect(result.settled).toBe(result.after)
    expect(result.remaining).toBe(0)
})

test("vanilla layout keeps an already-running radius animation available for scale correction", async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const { animate, LayoutAnimationBuilder } = (window as any).Motion
        const frame = () => new Promise(requestAnimationFrame)
        const box = document.createElement("div")
        box.className = "box"
        box.setAttribute("data-layout", "")
        document.querySelector("#container")!.append(box)
        const controls = animate(
            box,
            { borderRadius: [20, 40] },
            { duration: 4, ease: "linear" }
        )
        for (let i = 0; i < 3; i++) await frame()
        const beforeLayout = box.getAnimations().length
        const layout = await new LayoutAnimationBuilder(
            document,
            () => {
                box.style.width = "200px"
            },
            { duration: 2, ease: "linear" }
        )
        for (let i = 0; i < 15; i++) await frame()
        const style = getComputedStyle(box)
        const snapshot = {
            beforeLayout,
            native: box.getAnimations().length,
            radius: style.borderTopLeftRadius,
            transform: style.transform,
            width: box.getBoundingClientRect().width,
        }
        controls.complete()
        layout.complete()
        return snapshot
    })
    expect(result.beforeLayout).toBe(0)
    expect(result.native).toBe(0)
    expect(result.radius).toContain("%")
    expect(result.transform).not.toBe("none")
    expect(result.width).toBeGreaterThan(100)
    expect(result.width).toBeLessThan(200)
})

test("stopping a spring below the minimum CSS length does not restore the origin", async ({
    page,
}) => {
    const results = await page.evaluate(async () => {
        const { animate } = (window as any).Motion
        const frame = () => new Promise(requestAnimationFrame)
        const samples = []
        for (const [property, from, to] of [
            ["width", 100, 0],
            ["height", 100, 0],
            ["borderRadius", 100, 0],
            ["borderTopLeftRadius", "100%", "0%"],
        ] as const) {
            const box = document.createElement("div")
            box.className = "box"
            document.querySelector("#container")!.append(box)
            const controls = animate(
                box,
                { [property]: [from, to] },
                { type: "spring", stiffness: 100, damping: 1 }
            )
            for (let i = 0; i < 18; i++) await frame()
            const native = box.getAnimations().length
            const before = parseFloat(getComputedStyle(box)[property])
            controls.stop()
            for (let i = 0; i < 3; i++) await frame()
            samples.push({
                property,
                native,
                before,
                after: parseFloat(getComputedStyle(box)[property]),
            })
            box.remove()
        }
        return samples
    })
    for (const result of results) {
        expect(result.native).toBe(1)
        expect(result.before, result.property).toBe(0)
        expect(result.after, result.property).toBe(0)
    }
})
