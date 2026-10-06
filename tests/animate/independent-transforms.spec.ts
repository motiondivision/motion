import { expect, Page, test } from "@playwright/test"

/**
 * Independent transforms (x, y, scale, rotate etc) on an element are
 * composed into one hardware-accelerated `transform` WAAPI animation.
 * Each test runs a scenario in the page and returns what it measured.
 */

declare global {
    interface Window {
        Motion: any
        nextFrames: (count?: number) => Promise<void>
        wait: (ms: number) => Promise<void>
        readTransform: (element: Element) => {
            x: number
            y: number
            scale: number
            rotate: number
        }
        transformAnimations: (element: Element) => Animation[]
    }
}

async function load(page: Page) {
    await page.goto("animate/animate-independent-transforms.html")
    await page.waitForFunction(() => (window as any).ready)
}

test.describe("animate() independent transforms", () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => load(page))

    test("composes x, y, scale and rotate into one WAAPI animation", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            window.Motion.animate(
                element,
                { x: 100, y: 50, scale: 2, rotate: 90 },
                { duration: 1, ease: "linear" }
            )
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.wait(500)
            return { count, ...window.readTransform(element) }
        })

        expect(result.count).toBe(1)
        expect(result.x).toBeGreaterThan(40)
        expect(result.x).toBeLessThan(65)
        expect(result.y).toBeGreaterThan(20)
        expect(result.y).toBeLessThan(33)
        expect(result.scale).toBeGreaterThan(1.4)
        expect(result.scale).toBeLessThan(1.65)
        expect(result.rotate).toBeGreaterThan(36)
        expect(result.rotate).toBeLessThan(59)
    })

    test("doesn't write styles on the main thread while animating", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            window.Motion.animate(
                element,
                { x: 100 },
                { duration: 1, ease: "linear" }
            )
            await window.nextFrames(2)
            const styleBefore = element.style.transform
            const xBefore = window.readTransform(element).x
            await window.nextFrames(10)
            return {
                styleBefore,
                styleAfter: element.style.transform,
                xBefore,
                xAfter: window.readTransform(element).x,
            }
        })

        expect(result.styleAfter).toBe(result.styleBefore)
        expect(result.xAfter).toBeGreaterThan(result.xBefore)
    })

    test("writes the final value as an inline style", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            await window.Motion.animate(
                element,
                { x: 100, scale: 2 },
                { duration: 0.2 }
            )
            await window.nextFrames(2)
            return {
                style: element.style.transform,
                count: window.transformAnimations(element).length,
            }
        })

        expect(result.style).toBe("translateX(100px) scale(2)")
        expect(result.count).toBe(0)
    })

    test("separate animations on one element share one WAAPI animation", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 100 }, { duration: 1, ease: "linear" })
            await window.wait(100)
            animate(element, { scale: 2 }, { duration: 1, ease: "linear" })
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.wait(200)
            return { count, ...window.readTransform(element) }
        })

        expect(result.count).toBe(1)
        expect(result.x).toBeGreaterThan(20)
        expect(result.scale).toBeGreaterThan(1.1)
    })

    test("interrupting one value leaves the others running", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { x: 100, y: 100 },
                { duration: 1, ease: "linear" }
            )
            await window.wait(400)
            const finished = animate(
                element,
                { x: 0 },
                { duration: 0.4, ease: "linear" }
            )
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.wait(200)
            const mid = window.readTransform(element)
            await finished
            await window.wait(500)
            return {
                count,
                mid,
                end: window.readTransform(element),
                style: element.style.transform,
            }
        })

        expect(result.count).toBe(1)
        // x was ~40 when interrupted, and is half way back to 0.
        expect(result.mid.x).toBeGreaterThan(10)
        expect(result.mid.x).toBeLessThan(32)
        // y is unaffected, ~60% of the way to 100.
        expect(result.mid.y).toBeGreaterThan(50)
        expect(result.mid.y).toBeLessThan(75)
        expect(result.end.x).toBeCloseTo(0)
        expect(result.end.y).toBeCloseTo(100)
        expect(result.style).toBe("translateY(100px)")
    })

    test("an interrupting spring inherits velocity", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const transition = { type: "spring", stiffness: 100, damping: 20 }
            animate(element, { x: 400 }, transition)
            await window.wait(150)
            animate(element, { x: 0 }, transition)
            await window.nextFrames(1)
            const before = window.readTransform(element).x
            await window.nextFrames(3)
            return {
                count: window.transformAnimations(element).length,
                before,
                after: window.readTransform(element).x,
            }
        })

        expect(result.count).toBe(1)
        // Still moving right from the first spring's momentum.
        expect(result.after).toBeGreaterThan(result.before)
    })

    test("stop() leaves the element where it was", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const animation = window.Motion.animate(
                element,
                { x: 100 },
                { duration: 1, ease: "linear" }
            )
            await window.wait(500)
            animation.stop()
            const stoppedAt = window.readTransform(element).x
            await window.nextFrames(3)
            return {
                count: window.transformAnimations(element).length,
                stoppedAt,
                x: window.readTransform(element).x,
            }
        })

        expect(result.count).toBe(0)
        // Read straight after stop(), so within a frame of where it stops.
        expect(result.stoppedAt).toBeGreaterThan(40)
        expect(result.stoppedAt).toBeLessThan(65)
        expect(Math.abs(result.x - result.stoppedAt)).toBeLessThan(3)
    })

    test("pause() and play() hold and resume", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const animation = window.Motion.animate(
                element,
                { x: 100 },
                { duration: 1, ease: "linear" }
            )
            await window.wait(300)
            animation.pause()
            const paused = window.readTransform(element).x
            await window.wait(300)
            const held = window.readTransform(element).x
            animation.play()
            await window.wait(300)
            return {
                paused,
                held,
                resumed: window.readTransform(element).x,
                count: window.transformAnimations(element).length,
            }
        })

        // Read straight after pause(), so within a frame of where it holds.
        expect(Math.abs(result.held - result.paused)).toBeLessThan(3)
        expect(result.resumed).toBeGreaterThan(result.held + 20)
        expect(result.resumed).toBeLessThan(75)
        expect(result.count).toBe(1)
    })

    test("repeat: Infinity loops on the compositor", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            window.Motion.animate(
                element,
                { rotate: 360 },
                { duration: 1, ease: "linear", repeat: Infinity }
            )
            await window.nextFrames(2)
            const [animation] = window.transformAnimations(element)
            const style = element.style.transform
            const before = window.readTransform(element).rotate
            await window.wait(150)
            return {
                iterations: animation?.effect!.getComputedTiming().iterations,
                styleUnchanged: element.style.transform === style,
                before,
                after: window.readTransform(element).rotate,
            }
        })

        expect(result.iterations).toBe(Infinity)
        expect(result.styleUnchanged).toBe(true)
        expect(result.after).not.toBeCloseTo(result.before, 0)
    })

    test("a finite animation alongside an infinite one", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { rotate: 360 },
                { duration: 1, ease: "linear", repeat: Infinity }
            )
            const finished = animate(element, { x: 100 }, { duration: 0.3 })
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await finished
            await window.wait(100)
            const a = window.readTransform(element)
            await window.wait(100)
            const b = window.readTransform(element)
            return { count, a, b }
        })

        // A finite part, then a loop that takes over when it ends.
        expect(result.count).toBe(2)
        expect(result.a.x).toBeCloseTo(100)
        expect(result.b.x).toBeCloseTo(100)
        expect(result.b.rotate).not.toBeCloseTo(result.a.rotate, 0)
    })

    test("falls back to the main thread when one value can't be accelerated", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 100 }, { duration: 1, ease: "linear" })
            await window.wait(200)
            animate(
                element,
                { y: [0, 100] },
                { type: "inertia", velocity: 500 }
            )
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.wait(300)
            return { count, ...window.readTransform(element) }
        })

        expect(result.count).toBe(0)
        expect(result.x).toBeGreaterThan(40)
        expect(result.x).toBeLessThan(65)
        expect(result.y).toBeGreaterThan(20)
    })

    test("seeking every frame falls back to the main thread", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const animation = window.Motion.animate(
                element,
                { x: 100 },
                { duration: 1, ease: "linear" }
            )
            animation.pause()
            for (let i = 1; i <= 5; i++) {
                animation.time = i * 0.1
                await window.nextFrames(1)
            }
            await window.nextFrames(1)
            return {
                count: window.transformAnimations(element).length,
                ...window.readTransform(element),
            }
        })

        expect(result.count).toBe(0)
        expect(result.x).toBeCloseTo(50)
    })
})
