import {
    addBuilderToScope,
    animateLayout,
    delayInSeconds as delay,
    frame,
    hover,
    motionValue,
    MotionValue,
    resolveElements,
    scopeMotion,
    styleEffect,
    toMediaQuery,
} from "motion-dom"
import { animate } from ".."
import { inView } from "../../../render/dom/viewport"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

/**
 * JSDOM has no matchMedia. Each query's `matches` can be set by tests,
 * and `setMedia` fires change listeners like a real resize would.
 */
const media = new Map<
    string,
    { matches: boolean; listeners: Set<VoidFunction> }
>()

function getMedia(query: string) {
    let entry = media.get(query)
    if (!entry) {
        entry = { matches: false, listeners: new Set() }
        media.set(query, entry)
    }
    return entry
}

function setMedia(query: string, matches: boolean) {
    const entry = getMedia(query)
    entry.matches = matches
    entry.listeners.forEach((listener) => listener())
}

/**
 * Stopping an animation doesn't clear the value's animation (only
 * value.stop() does), so check the value stops changing instead.
 */
async function isAnimating(value: MotionValue) {
    const latest = value.get()
    await nextFrame()
    await nextFrame()
    return value.get() !== latest
}

const flushMicrotasks = () => new Promise<void>((r) => queueMicrotask(r))

beforeAll(() => {
    ;(window as any).matchMedia = (query: string) => {
        const entry = getMedia(query)
        return {
            get matches() {
                return entry.matches
            },
            addEventListener: (_: string, l: VoidFunction) =>
                entry.listeners.add(l),
            removeEventListener: (_: string, l: VoidFunction) =>
                entry.listeners.delete(l),
        }
    }
})

beforeEach(() => {
    media.clear()
    document.body.innerHTML = ""
})

describe("scopeMotion", () => {
    test("stop() stops animations started in setup", async () => {
        const x = motionValue(0)
        const scope = scopeMotion(() => {
            animate(x, 100, { duration: 10 })
        })

        expect(await isAnimating(x)).toBe(true)
        scope.stop()
        expect(await isAnimating(x)).toBe(false)
    })

    test("doesn't collect animations started outside the scope", async () => {
        const x = motionValue(0)
        const scope = scopeMotion()
        animate(x, 100, { duration: 10 })

        scope.stop()
        expect(await isAnimating(x)).toBe(true)
        x.stop()
    })

    test("run() and bind() collect into the scope", async () => {
        const a = motionValue(0)
        const b = motionValue(0)
        const scope = scopeMotion()

        scope.run(() => animate(a, 100, { duration: 10 }))
        const onClick = scope.bind(() => animate(b, 100, { duration: 10 }))

        expect(await isAnimating(b)).toBe(false)
        onClick()
        expect(await isAnimating(b)).toBe(true)

        scope.stop()
        expect(await isAnimating(a)).toBe(false)
        expect(await isAnimating(b)).toBe(false)
    })

    test("ignore() runs without collecting", async () => {
        const a = motionValue(0)
        const b = motionValue(0)

        const scope = scopeMotion(({ ignore }) => {
            animate(a, 100, { duration: 10 })
            ignore(() => animate(b, 100, { duration: 10 }))
        })

        scope.stop()
        expect(await isAnimating(a)).toBe(false)
        expect(await isAnimating(b)).toBe(true)
        b.stop()
    })

    test("bind() passes arguments and returns the result", async () => {
        const scope = scopeMotion()
        const add = scope.bind((a: number, b: number) => a + b)
        expect(add(1, 2)).toBe(3)
    })

    test("applies the default transition, which options override", async () => {
        let withDefault = 0
        let withOverride = 0

        scopeMotion(
            () => {
                withDefault = animate(motionValue(0), 1).duration
                withOverride = animate(motionValue(0), 1, {
                    duration: 2,
                }).duration
            },
            { transition: { duration: 5 } }
        )

        expect(withDefault).toBe(5)
        expect(withOverride).toBe(2)
    })

    test("applies the default transition to sequences", async () => {
        let duration = 0

        scopeMotion(
            () => {
                duration = animate([[motionValue(0), 1]]).duration
            },
            { transition: { duration: 4 } }
        )

        expect(duration).toBe(4)
    })

    test("resolves selectors inside the root element", async () => {
        document.body.innerHTML = `
            <div class="a"><span class="item"></span></div>
            <div class="b"><span class="item"></span></div>
        `
        const [inA, inB] = Array.from(
            document.querySelectorAll<HTMLElement>(".item")
        )

        const scope = scopeMotion(".b", () => {
            animate(".item", { opacity: 0.5 }, { duration: 10 })
        })

        return nextFrame().then(() => {
            expect(inA.style.opacity).toBe("")
            expect(inB.style.opacity).not.toBe("")
            scope.stop()
        })
    })

    test("accepts a root element with options, or a root that's missing", () => {
        document.body.innerHTML = `<div><span></span></div><span></span>`
        const root = document.body.firstElementChild!
        let duration = 0
        let found = 0

        scopeMotion(
            root,
            () => {
                duration = animate(motionValue(0), 1).duration
                found = resolveElements("span").length
            },
            { transition: { duration: 3 } }
        ).stop()

        expect(duration).toBe(3)
        expect(found).toBe(1)

        // querySelector() returning null falls back to the document
        scopeMotion(document.querySelector(".missing"), () => {
            found = resolveElements("span").length
        })
        expect(found).toBe(2)
    })

    test("cancel() restores inline styles and later animations read the DOM", async () => {
        document.body.innerHTML = `<div style="opacity: 0.8"></div>`
        const element = document.body.firstElementChild as HTMLElement

        const scope = scopeMotion(() => {
            animate(element, { opacity: 0.2 }, { duration: 0 })
        })

        await nextFrame()
        expect(element.style.opacity).toBe("0.2")

        scope.cancel()
        expect(element.getAttribute("style")).toBe("opacity: 0.8")

        // The element's values are released, so the next animation
        // starts from the restored DOM value
        expect(styleEffect.get(element, "opacity")).toBeUndefined()
    })

    test("removes an element's style attribute if it had none", async () => {
        document.body.innerHTML = `<div></div>`
        const element = document.body.firstElementChild as HTMLElement

        const scope = scopeMotion(() => {
            animate(element, { opacity: 0.2 }, { duration: 0 })
        })

        await nextFrame()
        scope.cancel()
        expect(element.hasAttribute("style")).toBe(false)
    })

    test("stop() removes gesture listeners started in the scope", async () => {
        document.body.innerHTML = `<div></div>`
        const element = document.body.firstElementChild as HTMLElement
        const onHover = jest.fn()

        const scope = scopeMotion(() => {
            hover(element, onHover)
        })
        scope.stop()

        element.dispatchEvent(
            new PointerEvent("pointerenter", { isPrimary: true } as any)
        )
        expect(onHover).not.toBeCalled()
    })

    test("stop() disconnects inView observers started in the scope", async () => {
        const disconnect = jest.fn()
        ;(window as any).IntersectionObserver = class {
            observe() {}
            disconnect = disconnect
        }
        document.body.innerHTML = `<div></div>`

        const scope = scopeMotion(() => {
            inView("div", () => {})
        })
        scope.stop()

        expect(disconnect).toBeCalled()
    })

    test("animations started in inView callbacks are collected", async () => {
        let trigger: (entries: any[]) => void = () => {}
        ;(window as any).IntersectionObserver = class {
            constructor(callback: any) {
                trigger = callback
            }
            observe() {}
            unobserve() {}
            disconnect() {}
        }
        document.body.innerHTML = `<div></div>`
        const x = motionValue(0)

        const scope = scopeMotion(() => {
            inView("div", () => {
                animate(x, 100, { duration: 10 })
            })
        })

        trigger([{ isIntersecting: true, target: document.body.firstChild }])
        expect(await isAnimating(x)).toBe(true)

        scope.stop()
        expect(await isAnimating(x)).toBe(false)
    })

    test("stop() cancels delays and collects their callbacks", async () => {
        const fired = jest.fn()
        const x = motionValue(0)

        const scope = scopeMotion(() => {
            delay(fired, 1)
            delay(() => animate(x, 100, { duration: 10 }), 0)
        })

        await nextFrame()
        await nextFrame()
        expect(await isAnimating(x)).toBe(true)

        scope.stop()
        expect(await isAnimating(x)).toBe(false)
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(fired).not.toBeCalled()
    })

    test("stops builder animations, including ones not started yet", async () => {
        const makeBuilder = () => {
            const animation = {
                stop: jest.fn(),
                finished: new Promise<void>(() => {}),
            }
            let resolve: (a: typeof animation) => void = () => {}
            const ready = new Promise<typeof animation>((r) => (resolve = r))
            return {
                animation,
                start: () => resolve(animation),
                then: (r: any, reject?: any) => ready.then(r, reject),
            }
        }
        const started = makeBuilder()
        const pending = makeBuilder()

        const scope = scopeMotion(() => {
            addBuilderToScope(started)
            addBuilderToScope(pending)
        })

        started.start()
        await flushMicrotasks()
        scope.stop()
        expect(started.animation.stop).toBeCalledTimes(1)

        pending.start()
        await flushMicrotasks()
        expect(pending.animation.stop).toBeCalledTimes(1)
    })

    test("animateLayout() inside a scope uses its root and transition", async () => {
        document.body.innerHTML = `<div class="root"></div>`
        const root = document.querySelector(".root")!
        let builder: any

        scopeMotion(
            root,
            () => {
                builder = animateLayout(() => {})
            },
            { transition: { duration: 3 } }
        )

        expect(builder.scope).toBe(root)
        expect(builder.defaultOptions).toEqual({ duration: 3 })
    })

    test("state reports active, stopped and cancelled", () => {
        const a = scopeMotion()
        expect(a.state).toBe("active")
        a.stop()
        expect(a.state).toBe("stopped")

        const b = scopeMotion()
        b.cancel()
        expect(b.state).toBe("cancelled")
        b.refresh()
        expect(b.state).toBe("active")
    })

    test("calls the cleanup returned from setup", async () => {
        const cleanup = jest.fn()
        const scope = scopeMotion(() => cleanup)

        expect(cleanup).not.toBeCalled()
        scope.stop()
        expect(cleanup).toBeCalledTimes(1)
    })

    test("a scope created inside another is cancelled with it", async () => {
        const x = motionValue(0)
        const outer = scopeMotion(() => {
            scopeMotion(() => {
                animate(x, 100, { duration: 10 })
            })
        })

        outer.stop()
        expect(await isAnimating(x)).toBe(false)
    })

    describe("matchMedia", () => {
        test("runs setup only while a query matches", async () => {
            const setup = jest.fn()
            const query = "(width >= 800px)"

            scopeMotion(setup, { matchMedia: ">=800" })
            expect(setup).not.toBeCalled()

            setMedia(query, true)
            await flushMicrotasks()
            expect(setup).toBeCalledTimes(1)
        })

        test("cancels and reruns setup when media conditions change", async () => {
            const desktop = "(width >= 800px)"
            const reduce = "(prefers-reduced-motion: reduce)"
            setMedia(desktop, true)

            const x = motionValue(0)
            const cleanup = jest.fn()
            const seen: Array<Record<string, boolean>> = []

            const scope = scopeMotion(
                ({ media }) => {
                    seen.push({ ...media })
                    animate(x, 100, { duration: 10 })
                    return cleanup
                },
                { matchMedia: { desktop: ">=800", reduce: "reducedMotion" } }
            )

            expect(seen).toEqual([{ desktop: true, reduce: false }])
            expect(scope.media).toEqual({ desktop: true, reduce: false })

            // Two conditions change together, setup reruns once
            setMedia(desktop, false)
            setMedia(reduce, true)
            await flushMicrotasks()

            expect(cleanup).toBeCalledTimes(1)
            expect(seen).toEqual([
                { desktop: true, reduce: false },
                { desktop: false, reduce: true },
            ])

            // No condition matches, so setup doesn't run
            setMedia(reduce, false)
            await flushMicrotasks()
            expect(cleanup).toBeCalledTimes(2)
            expect(seen.length).toBe(2)
            expect(await isAnimating(x)).toBe(false)
        })

        test("stop() removes media listeners", async () => {
            const setup = jest.fn()
            const query = "(prefers-color-scheme: dark)"
            const scope = scopeMotion(setup, { matchMedia: "dark" })

            scope.stop()
            setMedia(query, true)
            await flushMicrotasks()

            expect(setup).not.toBeCalled()
            expect(getMedia(query).listeners.size).toBe(0)
        })

        test("refresh() cancels and reruns setup", async () => {
            const setup = jest.fn()
            const scope = scopeMotion(setup)
            scope.refresh()
            expect(setup).toBeCalledTimes(2)
        })
    })
})

describe("toMediaQuery", () => {
    test("passes full media queries through", async () => {
        expect(toMediaQuery("(min-width: 800px)")).toBe("(min-width: 800px)")
        expect(toMediaQuery("screen and (hover: hover)")).toBe(
            "screen and (hover: hover)"
        )
    })

    test("converts width comparisons", async () => {
        expect(toMediaQuery(">=800")).toBe("(width >= 800px)")
        expect(toMediaQuery("< 40em")).toBe("(width < 40em)")
        expect(toMediaQuery(">=800 <1200px")).toBe(
            "(width >= 800px) and (width < 1200px)"
        )
    })

    test("converts keywords", async () => {
        expect(toMediaQuery("reducedMotion")).toBe(
            "(prefers-reduced-motion: reduce)"
        )
        expect(toMediaQuery(">=800 hover")).toBe(
            "(width >= 800px) and (hover: hover) and (pointer: fine)"
        )
        expect(toMediaQuery("print")).toBe("print")
    })

    test("negates tokens prefixed with !", () => {
        expect(toMediaQuery("!touch")).toBe("(not ((pointer: coarse)))")
        expect(toMediaQuery(">=800 !hover")).toBe(
            "(width >= 800px) and (not ((hover: hover) and (pointer: fine)))"
        )
        expect(toMediaQuery("! <800")).toBe("(not ((width < 800px)))")
    })
})
