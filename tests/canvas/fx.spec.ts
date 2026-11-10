import { expect, test } from "@playwright/test"

/**
 * <motion-fx> is at the page's top-left, 400 x 300 CSS pixels. #card is
 * 100 x 60 and red, at its top-left.
 */
const red = [255, 0, 0, 255]
const cyan = [0, 255, 255, 255]

test.describe("<motion-fx> shaders", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("canvas/fx.html")
        await page.waitForFunction(() => (window as any).ready)
    })

    test("runs shaders set before the element was defined", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            const px = await w.nextRender()
            return { card: px.at(50, 30), empty: px.at(350, 200) }
        })
        expect(result.card).toEqual(cyan)
        expect(result.empty[3]).toBe(0)
    })

    test("draws as before without shaders", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            w.host.shaders = []
            const px = await w.nextRender()
            return { card: px.at(50, 30), empty: px.at(350, 200) }
        })
        expect(result.card).toEqual(red)
        expect(result.empty[3]).toBe(0)
    })

    test("runs shaders in order, each on the result of the last", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            const read = async (shaders: unknown[]) => {
                w.host.shaders = shaders
                // Shaders compile over a few frames
                for (let i = 0; i < 5; i++) await w.nextRender()
                const px = await w.nextRender()
                return { from: px.at(50, 30), to: px.at(250, 30) }
            }
            const shift = () => w.shader(w.shift, { amount: 0.5 })
            const invertLeft = () => w.shader(w.invertLeft)
            return {
                shiftFirst: await read([shift(), invertLeft()]),
                invertFirst: await read([invertLeft(), shift()]),
            }
        })
        // Moved to the right half before the left half is inverted
        expect(result.shiftFirst.to).toEqual(red)
        expect(result.shiftFirst.from[3]).toBe(0)
        // Inverted in the left half, then moved
        expect(result.invertFirst.to).toEqual(cyan)
        expect(result.invertFirst.from[3]).toBe(0)
    })

    test("reads motion values as uniforms and redraws when they change", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            const amount = w.motionValue(0)
            w.host.shaders = [w.shader(w.shift, { amount })]
            for (let i = 0; i < 5; i++) await w.nextRender()
            const before = (await w.nextRender()).at(50, 30)

            const rendered = new Promise((resolve) => {
                const stop = w.host.layer.onRender(() => {
                    stop()
                    resolve(true)
                })
            })
            amount.set(0.5)
            await rendered
            const px = await w.nextRender()
            return { before, from: px.at(50, 30), to: px.at(250, 30) }
        })
        expect(result.before).toEqual(red)
        expect(result.from[3]).toBe(0)
        expect(result.to).toEqual(red)
    })

    test("skips a shader that doesn't compile, with a warning", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            w.host.shaders = [w.shader(w.broken), w.shader(w.invert)]
            for (let i = 0; i < 5; i++) await w.nextRender()
            const px = await w.nextRender()
            return { card: px.at(50, 30), warnings: w.warnings.join() }
        })
        expect(result.card).toEqual(cyan)
        expect(result.warnings).toMatch(/shader failed/)
    })

    test("motionBlur() sets the motion blur of the children", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            const { layer } = w.host
            w.host.shaders = [w.motionBlur({ strength: 0.8, samples: 6 })]
            const on = [layer.motionBlur, layer.samples]
            w.host.shaders = [w.motionBlur()]
            const defaults = [layer.motionBlur, layer.samples]
            w.host.shaders = []
            return { on, defaults, off: [layer.motionBlur, layer.samples] }
        })
        expect(result.on).toEqual([0.8, 6])
        expect(result.defaults).toEqual([0.5, 24])
        expect(result.off).toEqual([0, 24])
    })

    test("the built-in effects compile and draw", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            w.host.shaders = [
                w.chromaticAberration({ amount: 0 }),
                w.pixelate({ size: 4 }),
            ]
            for (let i = 0; i < 5; i++) await w.nextRender()
            const px = await w.nextRender()
            return {
                card: px.at(50, 30),
                empty: px.at(350, 200),
                warnings: w.warnings.join(),
            }
        })
        expect(result.card).toEqual(red)
        expect(result.empty[3]).toBe(0)
        expect(result.warnings).toBe("")
    })
})

test.describe("<MotionFX>", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("canvas/fx-react.html")
        await page.waitForFunction(() => (window as any).ready)
    })

    test("draws motion components with shaders from props", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const w = window as any
            for (let i = 0; i < 5; i++) await w.nextRender()
            const on = (await w.nextRender()).at(50, 30)

            w.setX(200)
            for (let i = 0; i < 5; i++) await w.nextRender()
            const moved = await w.nextRender()

            w.setOn(false)
            for (let i = 0; i < 5; i++) await w.nextRender()
            const off = (await w.nextRender()).at(250, 30)

            return {
                supported: w.host.supported,
                className: w.host.className,
                on,
                movedFrom: moved.at(50, 30),
                movedTo: moved.at(250, 30),
                off,
            }
        })
        expect(result.supported).toBe(true)
        expect(result.className).toBe("fx")
        expect(result.on).toEqual(cyan)
        expect(result.movedFrom[3]).toBe(0)
        expect(result.movedTo).toEqual(cyan)
        expect(result.off).toEqual(red)
    })
})
