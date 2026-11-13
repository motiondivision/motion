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
        waitFrame: (ms: number) => Promise<void>
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
            await window.waitFrame(500)
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
            await window.waitFrame(100)
            animate(element, { scale: 2 }, { duration: 1, ease: "linear" })
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.waitFrame(200)
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
            await window.waitFrame(400)
            const finished = animate(
                element,
                { x: 0 },
                { duration: 0.4, ease: "linear" }
            )
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.waitFrame(200)
            const mid = window.readTransform(element)
            await finished
            await window.waitFrame(500)
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

    test("a linear value keeps its pace when another value interrupts", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const start = document.timeline.currentTime as number
            animate(element, { y: 200 }, { duration: 1.5, ease: "linear" })
            await window.waitFrame(300)
            animate(element, { x: 100 }, { duration: 0.4, ease: "easeOut" })
            const frames: any[] = await (window as any).recordFrames(
                element,
                1300
            )
            await window.nextFrames(2)
            return {
                frames: frames.map((frame) => ({
                    ...frame,
                    t: frame.t - start,
                })),
                style: element.style.transform,
            }
        })

        let x = 0
        for (const frame of result.frames) {
            // Within a frame of where it'd be, when it started.
            const y = Math.min(200, (frame.t / 1500) * 200)
            expect(Math.abs(frame.y - y)).toBeLessThan(4)
            expect(frame.x).toBeGreaterThanOrEqual(x - 0.01)
            x = frame.x
        }
        expect(x).toBeCloseTo(100)
        expect(result.style).toBe("translateX(100px) translateY(200px)")
    })

    test("an interrupting spring inherits velocity", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { x: 400 },
                { type: "spring", stiffness: 100, damping: 20 }
            )
            await window.waitFrame(150)
            const before = window.readTransform(element).x

            /**
             * A soft spring keeps the inherited momentum carrying the
             * element right for several frames, so the check doesn't
             * depend on when the browser renders each frame.
             */
            animate(
                element,
                { x: 0 },
                { type: "spring", stiffness: 50, damping: 5 }
            )
            const samples: number[] = []
            for (let i = 0; i < 4; i++) {
                await window.nextFrames(1)
                samples.push(window.readTransform(element).x)
            }
            return {
                count: window.transformAnimations(element).length,
                before,
                peak: Math.max(...samples),
            }
        })

        expect(result.count).toBe(1)
        /**
         * Still moving right from the first spring's momentum. Without it
         * the element moves left at once (at most ~1px right of before, as
         * the interrupt lands mid-frame).
         */
        expect(result.peak - result.before).toBeGreaterThan(20)
    })

    test("stop() leaves the element where it was", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const animation = window.Motion.animate(
                element,
                { x: 100 },
                { duration: 1, ease: "linear" }
            )
            await window.waitFrame(500)
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
            await window.waitFrame(300)
            animation.pause()
            const paused = window.readTransform(element).x
            await window.waitFrame(300)
            const held = window.readTransform(element).x
            animation.play()
            await window.waitFrame(300)
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

    /**
     * onUpdate keeps the group on the main thread, which mustn't leave an
     * animation paused before its first frame unrendered (#4073).
     */
    for (const pauseWith of ["pause()", "autoplay: false"]) {
        test(`an animation with onUpdate paused with ${pauseWith} renders its first keyframe`, async ({
            page,
        }) => {
            const result = await page.evaluate(async (pauseWith) => {
                const element = document.getElementById("a")!
                const updates: number[] = []
                const options: any = {
                    duration: 0.3,
                    ease: "linear",
                    onUpdate: (latest: number) => updates.push(latest),
                }
                if (pauseWith !== "pause()") options.autoplay = false
                const animation = window.Motion.animate(
                    element,
                    { x: [100, 0] },
                    options
                )
                if (pauseWith === "pause()") animation.pause()
                await window.waitFrame(100)
                const paused = window.readTransform(element).x
                const pausedUpdates = updates.slice()
                animation.play()
                await window.waitFrame(150)
                const playing = window.readTransform(element).x
                await window.waitFrame(300)
                return {
                    paused,
                    pausedUpdates,
                    playing,
                    finished: window.readTransform(element).x,
                }
            }, pauseWith)

            expect(result.paused).toBeCloseTo(100, 0)
            expect(result.pausedUpdates.length).toBeGreaterThan(0)
            expect(result.pausedUpdates.every((x) => x === 100)).toBe(true)
            expect(result.playing).toBeGreaterThan(5)
            expect(result.playing).toBeLessThan(95)
            expect(result.finished).toBeCloseTo(0, 0)
        })
    }

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
            await window.waitFrame(150)
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
            await window.waitFrame(100)
            const a = window.readTransform(element)
            await window.waitFrame(100)
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
            await window.waitFrame(200)
            animate(
                element,
                { y: [0, 100] },
                { type: "inertia", velocity: 500 }
            )
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.waitFrame(300)
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

    test("a paused animation seeked every frame plays on the compositor", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const animation = window.Motion.animate(
                element,
                { x: 100, y: 50 },
                { duration: 1, ease: "linear" }
            )
            animation.pause()
            const seeked: number[] = []
            for (let i = 1; i <= 5; i++) {
                animation.time = i * 0.1
                // Read once Motion has rendered the frame.
                await new Promise((resolve) =>
                    window.Motion.frame.postRender(resolve)
                )
                seeked.push(window.readTransform(element).x)
            }
            animation.play()
            await window.nextFrames(2)
            const count = window.transformAnimations(element).length
            await window.waitFrame(200)
            return { seeked, count, ...window.readTransform(element) }
        })

        expect(result.seeked.map(Math.round)).toEqual([10, 20, 30, 40, 50])
        expect(result.count).toBe(1)
        expect(result.x).toBeGreaterThan(62)
        expect(result.x).toBeLessThan(85)
        expect(result.y).toBeCloseTo(result.x / 2, 0)
    })

    test("shows a value set instantly while others run on the compositor", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(element, { x: 100 }, { duration: 1, ease: "linear" })
            await window.waitFrame(200)
            animate(element, { y: 50 }, { duration: 0 })
            animate(element, { scale: [2, 2] }, { duration: 1 })
            await window.nextFrames(2)
            return {
                count: window.transformAnimations(element).length,
                ...window.readTransform(element),
            }
        })

        expect(result.count).toBe(1)
        expect(result.x).toBeGreaterThan(15)
        expect(result.x).toBeLessThan(40)
        expect(result.y).toBeCloseTo(50)
        expect(result.scale).toBeCloseTo(2)
    })

    test("pause() and play() on interrupted controls change nothing", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            const first = animate(
                element,
                { x: 100 },
                { duration: 1, ease: "linear" }
            )
            await window.waitFrame(100)
            animate(element, { x: 50 }, { duration: 0.3, ease: "linear" })
            await window.waitFrame(50)
            const recording = (window as any).recordFrames(element, 400)
            first.pause()
            first.play()
            const frames: Array<{ x: number }> = await recording
            return {
                frames: frames.map((frame) => frame.x),
                count: window.transformAnimations(element).length,
                ...window.readTransform(element),
            }
        })

        // The interrupting animation keeps moving until it ends.
        const stalled = result.frames.filter(
            (x, i) => i && x < 49.9 && x === result.frames[i - 1]
        )
        expect(stalled.length).toBeLessThanOrEqual(1)
        expect(result.count).toBe(0)
        expect(result.x).toBeCloseTo(50)
    })

    test.describe("a spring from px to %", () => {
        for (const transition of [
            { type: "spring", stiffness: 300, damping: 30 },
            { duration: 0.6, ease: "anticipate" },
        ]) {
            test(`stays within its target (${
                transition.type || transition.ease
            })`, async ({ page }) => {
                const result = await page.evaluate(async (transition) => {
                    const element = document.getElementById("a")!
                    element.style.width = "200px"
                    const { animate } = window.Motion
                    await animate(element, { x: 20 }, { duration: 0 })
                    await window.nextFrames(2)
                    animate(element, { x: "50%" }, transition)
                    const xs: number[] = []
                    for (let i = 0; i < 60; i++) {
                        xs.push(window.readTransform(element).x)
                        await window.nextFrames(1)
                    }
                    return { max: Math.max(...xs), end: xs[xs.length - 1] }
                }, transition)

                expect(result.max).toBeLessThan(110)
                expect(result.end).toBeCloseTo(100, 0)
            })
        }
    })

    test("pause() and time with a delay", async ({ page }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const animation = window.Motion.animate(
                element,
                { x: 100 },
                { duration: 1, delay: 1, ease: "linear" }
            )
            await window.waitFrame(1500)
            animation.pause()
            await window.nextFrames(3)
            const paused = animation.time

            // As with WAAPI's currentTime, a seek includes the delay.
            animation.time = 1.25
            await window.nextFrames(2)
            return {
                paused,
                time: animation.time,
                x: window.readTransform(element).x,
            }
        })

        expect(result.paused).toBeGreaterThan(0.4)
        expect(result.paused).toBeLessThan(0.65)
        expect(result.time).toBeCloseTo(0.25, 2)
        expect(result.x).toBeCloseTo(25, 0)
    })

    test("an animation cancelled from outside still finishes", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            let finished = false
            window.Motion.animate(
                element,
                { x: 100 },
                { duration: 0.5, ease: "linear" }
            ).then(() => (finished = true))
            await window.waitFrame(200)
            element.getAnimations().forEach((animation) => animation.cancel())
            await window.nextFrames(1)
            const x = window.readTransform(element).x
            await window.waitFrame(500)
            return { x, finished, end: window.readTransform(element).x }
        })

        expect(result.x).toBeGreaterThan(30)
        expect(result.x).toBeLessThan(70)
        expect(result.finished).toBe(true)
        expect(result.end).toBe(100)
    })

    test("a finished animation doesn't stay alongside a loop", async ({
        page,
    }) => {
        const count = await page.evaluate(async () => {
            const element = document.getElementById("a")!
            const { animate } = window.Motion
            animate(
                element,
                { rotate: [0, 90] },
                { duration: 0.4, repeat: Infinity, repeatType: "reverse" }
            )
            animate(element, { x: 100 }, { duration: 0.3 })
            await window.waitFrame(700)
            return window.transformAnimations(element).length
        })

        expect(count).toBe(1)
    })

    /**
     * A round trip built from where it started, give or take a float
     * residue, can't share one easing. Stretching it over that residue
     * gives an easing the compositor can't render, and the element stops
     * painting, although getComputedStyle reads right.
     */
    test("a round trip from a float residue keeps painting", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const element = document.getElementById("a")!
            element.style.marginTop = "50px"
            window.Motion.animate(
                element,
                { y: [-1e-30, -18, 0] },
                { duration: 1.2, ease: "easeInOut", repeat: Infinity }
            )
            await window.waitFrame(300)
        })

        const screenshot = await page.screenshot()
        const color = await page.evaluate(async (src) => {
            const image = new Image()
            image.src = src
            await image.decode()
            const canvas = document.createElement("canvas")
            canvas.width = image.width
            canvas.height = image.height
            const context = canvas.getContext("2d")!
            context.drawImage(image, 0, 0)
            return Array.from(context.getImageData(50, 100, 1, 1).data)
        }, "data:image/png;base64," + screenshot.toString("base64"))

        // The box's colour, #0077ff, not the white page behind it.
        expect(color[0]).toBeLessThan(50)
        expect(color[2]).toBeGreaterThan(200)
    })

    test("a sequence builds later segments before they start, and starts them on time", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const a = document.getElementById("a")!
            const b = document.getElementById("b")!
            const start = document.timeline.currentTime as number
            window.Motion.animate([
                [a, { x: 100 }, { duration: 0.3, ease: "linear" }],
                [
                    b,
                    { x: 100, y: 20 },
                    { duration: 0.4, ease: "linear", at: 0.5 },
                ],
            ])
            await window.nextFrames(2)
            const early = window.transformAnimations(b).length
            await window.waitFrame(440)
            const before = {
                count: window.transformAnimations(b).length,
                ...window.readTransform(b),
            }
            const frames: any[] = await (window as any).recordFrames(b, 500)
            return {
                early,
                before,
                frames: frames.map((frame) => ({
                    ...frame,
                    t: frame.t - start,
                })),
                style: b.style.transform,
            }
        })

        // Not built at first, but built before it starts.
        expect(result.early).toBe(0)
        expect(result.before.count).toBe(1)
        expect(result.before.x).toBe(0)

        for (const { t, x, y } of result.frames) {
            /**
             * Linear from 500ms to 900ms, give or take when the sequence
             * started, within a frame of the call.
             */
            const expected = Math.min(100, Math.max(0, (t - 500) / 4))
            expect(Math.abs(x - expected)).toBeLessThan(6)
            expect(Math.abs(y - expected / 5)).toBeLessThan(1.5)
        }
        expect(result.frames.some(({ x }) => x > 20 && x < 80)).toBe(true)
        expect(result.style).toBe("translateX(100px) translateY(20px)")
    })

    test("a sequence paused and played before its segments start keeps them on time", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const a = document.getElementById("a")!
            const b = document.getElementById("b")!
            const c = document.getElementById("c")!
            const start = document.timeline.currentTime as number
            const animation = window.Motion.animate([
                [a, { x: 100 }, { duration: 0.3, ease: "linear" }],
                [b, { x: 100 }, { duration: 0.4, ease: "linear", at: 0.5 }],
                [c, { x: 100 }, { duration: 0.4, ease: "linear", at: 0.8 }],
            ])
            /**
             * b is built shortly before it starts. c is still waiting to
             * be built.
             */
            await window.waitFrame(440)
            const [built] = window.transformAnimations(b)
            const waiting = window.transformAnimations(c).length
            animation.pause()
            const pausedAt = document.timeline.currentTime as number
            await window.waitFrame(200)
            const held = [window.readTransform(b).x, window.readTransform(c).x]
            animation.play()
            const paused = (document.timeline.currentTime as number) - pausedAt
            await window.nextFrames(1)
            const isSame = window.transformAnimations(b)[0] === built
            const frames: any[] = await new Promise((resolve) => {
                const recorded: any[] = []
                const record = () => {
                    const t = document.timeline.currentTime as number
                    recorded.push({
                        t: t - start - paused,
                        b: window.readTransform(b).x,
                        c: window.readTransform(c).x,
                    })
                    if (t - pausedAt - paused >= 800) {
                        window.Motion.cancelFrame(record)
                        resolve(recorded)
                    }
                }
                window.Motion.frame.postRender(record, true)
            })
            return {
                isBuilt: !!built,
                waiting,
                held,
                isSame,
                frames,
            }
        })

        expect(result.isBuilt).toBe(true)
        expect(result.waiting).toBe(0)
        expect(result.held).toEqual([0, 0])
        // b's WAAPI animation was held and played, not rebuilt.
        expect(result.isSame).toBe(true)

        /**
         * Linear from 500ms (b) and 800ms (c) for 400ms, later by the
         * pause, give or take a frame.
         */
        const check = (key: "b" | "c", from: number) => {
            for (const frame of result.frames) {
                const expected = Math.min(
                    100,
                    Math.max(0, (frame.t - from) / 4)
                )
                expect(Math.abs(frame[key] - expected)).toBeLessThan(6)
            }
            expect(
                result.frames.some(
                    (frame: any) => frame[key] > 20 && frame[key] < 80
                )
            ).toBe(true)
        }
        check("b", 500)
        check("c", 800)
    })

    test("a sequence segment follows an easing WAAPI can't run", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const a = document.getElementById("a")!
            const b = document.getElementById("b")!
            const { animate, backOut } = window.Motion
            const start = document.timeline.currentTime as number
            animate([
                [a, { x: 100 }, { duration: 0.2, ease: "linear" }],
                [
                    b,
                    { x: 100, rotate: 90 },
                    { duration: 0.6, ease: "backOut", at: 0.3 },
                ],
            ])
            const frames: any[] = await (window as any).recordFrames(b, 1000)
            /**
             * Where JS puts it, within a frame either side.
             */
            const at = (t: number) =>
                backOut(Math.min(1, Math.max(0, (t - start - 300) / 600))) * 100
            return frames.map((frame) => {
                const range = [-17, -8, 0, 8, 17].map((ms) => at(frame.t + ms))
                return {
                    ...frame,
                    low: Math.min(...range) - 1,
                    high: Math.max(...range) + 1,
                }
            })
        })

        for (const { x, rotate, low, high, count } of result) {
            expect(x).toBeGreaterThan(low)
            expect(x).toBeLessThan(high)
            expect(rotate).toBeGreaterThan(low * 0.9 - 1)
            expect(rotate).toBeLessThan(high * 0.9 + 1)
            expect(count).toBeLessThan(2)
        }
        // It overshoots, as backOut does.
        expect(Math.max(...result.map(({ x }) => x))).toBeGreaterThan(105)
    })

    test("a sequence renders where it's seeked to, forwards and backwards", async ({
        page,
    }) => {
        const result = await page.evaluate(async () => {
            const a = document.getElementById("a")!
            const b = document.getElementById("b")!
            const animation = window.Motion.animate([
                [a, { x: 100 }, { duration: 0.3, ease: "linear" }],
                [b, { x: 100 }, { duration: 0.4, ease: "linear", at: 0.5 }],
            ])
            await window.waitFrame(50)
            animation.pause()
            animation.time = 0.7
            await window.waitFrame(50)
            const seeked = [
                window.readTransform(a).x,
                window.readTransform(b).x,
            ]
            animation.time = 0.15
            await window.waitFrame(50)
            const early = [window.readTransform(a).x, window.readTransform(b).x]
            animation.time = 0.8
            animation.speed = -1
            animation.play()
            await window.waitFrame(200)
            const reversed = [
                window.readTransform(a).x,
                window.readTransform(b).x,
            ]
            return { seeked, early, reversed }
        })

        expect(result.seeked[0]).toBeCloseTo(100, 0)
        expect(result.seeked[1]).toBeCloseTo(50, 0)
        expect(result.early[0]).toBeCloseTo(50, 0)
        expect(result.early[1]).toBeCloseTo(0, 0)
        // Back from 0.8s to ~0.6s, give or take a frame or two.
        expect(result.reversed[0]).toBeCloseTo(100, 0)
        expect(result.reversed[1]).toBeGreaterThan(15)
        expect(result.reversed[1]).toBeLessThan(42)
    })
})
