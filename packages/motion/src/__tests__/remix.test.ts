import { jsx } from "remix/component/jsx-runtime"
import { createElement, createRoot } from "remix/component"
import type { Handle } from "remix/component"
import { motionValue } from "framer-motion/dom"
import { AnimatePresence, motion, scopeMotion } from "../remix"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const transition = { duration: 0.2, ease: "linear" } as const

function setup(render: (handle: Handle) => () => any) {
    const container = document.createElement("div")
    document.body.appendChild(container)
    let update!: () => Promise<AbortSignal>

    function App(handle: Handle) {
        update = () => handle.update()
        return render(handle)
    }

    createRoot(container).render(createElement(App, {}))
    return { container, update: () => update() }
}

describe("motion/remix", () => {
    it("animates from initial to animate on insert", async () => {
        const { container } = setup(
            () => () =>
                createElement("div", {
                    mix: motion({
                        initial: { opacity: 0 },
                        animate: { opacity: 1 },
                        transition,
                    }),
                })
        )
        await wait(20)
        const element = container.firstElementChild as HTMLElement

        await wait(80)
        const mid = parseFloat(element.style.opacity)
        expect(mid).toBeGreaterThan(0)
        expect(mid).toBeLessThan(1)

        await wait(300)
        expect(element.style.opacity).toBe("1")
    })

    it("animates when animate changes and keeps values on re-render", async () => {
        let opacity = 0.5
        const { container, update } = setup(
            () => () =>
                createElement("div", {
                    mix: motion({
                        initial: { opacity: 0 },
                        animate: { opacity },
                        transition,
                    }),
                })
        )
        await wait(300)
        const element = container.firstElementChild as HTMLElement
        expect(element.style.opacity).toBe("0.5")

        opacity = 1
        await update()
        await wait(300)
        expect(element.style.opacity).toBe("1")

        await update()
        await wait(50)
        expect(element.style.opacity).toBe("1")
    })

    it("keeps an element in the DOM until exit finishes", async () => {
        let visible = true
        const { container, update } = setup(
            () => () =>
                createElement(
                    "section",
                    {},
                    visible &&
                        createElement("div", {
                            key: "box",
                            mix: motion({
                                initial: false,
                                animate: { opacity: 1 },
                                exit: { opacity: 0 },
                                transition,
                            }),
                            style: { opacity: 1 },
                        })
                )
        )
        await wait(20)
        const section = container.firstElementChild!

        visible = false
        await update()
        await wait(80)
        expect(section.children.length).toBe(1)

        await wait(300)
        expect(section.children.length).toBe(0)
    })

    it("reuses an exiting element if it comes back", async () => {
        let visible = true
        const { container, update } = setup(
            () => () =>
                createElement(
                    "section",
                    {},
                    visible &&
                        createElement("div", {
                            key: "box",
                            mix: motion({
                                initial: false,
                                animate: { opacity: 1 },
                                exit: { opacity: 0 },
                                transition,
                            }),
                            style: { opacity: 1 },
                        })
                )
        )
        await wait(20)
        const section = container.firstElementChild!
        const element = section.firstElementChild as HTMLElement

        visible = false
        await update()
        await wait(80)

        visible = true
        await update()
        await wait(400)

        expect(section.children.length).toBe(1)
        expect(section.firstElementChild).toBe(element)
        expect(element.style.opacity).toBe("1")
    })

    it("runs and cancels a scopeMotion with its element", async () => {
        let visible = true
        let cleanup = jest.fn()
        const scopeSetup = jest.fn(() => cleanup)

        const { container, update } = setup(
            () => () =>
                createElement(
                    "section",
                    {},
                    visible &&
                        createElement("div", {
                            key: "box",
                            mix: scopeMotion(scopeSetup),
                        })
                )
        )
        await wait(20)
        expect(scopeSetup).toHaveBeenCalledTimes(1)
        expect(container.querySelector("div")).not.toBeNull()

        visible = false
        await update()
        await wait(20)
        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    it("keeps a parent in the DOM until exits inside it finish", async () => {
        let visible = true
        const { container, update } = setup(
            () => () =>
                createElement(
                    "div",
                    {},
                    visible &&
                        createElement(
                            motion.section,
                            {
                                key: "outer",
                                exit: { opacity: 0 },
                                transition: { duration: 0.05 },
                                style: { opacity: 1 },
                            },
                            createElement(motion.p, {
                                exit: { opacity: 0 },
                                transition: { duration: 0.3 },
                                style: { opacity: 1 },
                            })
                        )
                )
        )
        await wait(20)
        const root = container.firstElementChild!

        visible = false
        await update()
        await wait(150)
        expect(root.children.length).toBe(1)

        await wait(400)
        expect(root.children.length).toBe(0)
    })

    it("animates variants through children and calls onAnimationComplete", async () => {
        const onAnimationComplete = jest.fn()
        const item = { hidden: { opacity: 0 }, visible: { opacity: 1 } }
        const { container } = setup(
            () => () =>
                createElement(
                    motion.ul,
                    {
                        initial: "hidden",
                        animate: "visible",
                        variants: {
                            visible: { transition: { staggerChildren: 0.1 } },
                        },
                        transition: { duration: 0.05 },
                        onAnimationComplete,
                    },
                    createElement(motion.li, { variants: item }),
                    createElement(motion.li, { variants: item })
                )
        )
        await wait(20)
        const items = container.querySelectorAll("li")
        // The second item is still waiting for its stagger delay.
        expect((items[1] as HTMLElement).style.opacity).toBe("0")

        await wait(400)
        expect((items[0] as HTMLElement).style.opacity).toBe("1")
        expect((items[1] as HTMLElement).style.opacity).toBe("1")
        expect(onAnimationComplete.mock.calls[0][0]).toBe("visible")
    })

    it("renders motion values in style", async () => {
        const x = motionValue(0)
        const { container } = setup(
            () => () => createElement(motion.div, { style: { x } })
        )
        await wait(20)

        x.set(30)
        await wait(50)
        expect(
            (container.firstElementChild as HTMLElement).style.transform
        ).toBe("translateX(30px)")
    })

    it("doesn't mount an element removed before it mounts", async () => {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)
        const onAnimationStart = jest.fn()

        root.render(
            createElement(motion.div, {
                animate: { opacity: 0.5 },
                onAnimationStart,
            })
        )
        root.flush()
        expect(container.firstElementChild).not.toBeNull()
        root.render(null)
        root.flush()

        await wait(50)
        expect(container.firstElementChild).toBeNull()
        expect(onAnimationStart).not.toHaveBeenCalled()
    })

    it("mounts other elements when one throws", async () => {
        const errors: unknown[] = []
        const onError = (event: ErrorEvent) => {
            event.preventDefault()
            errors.push(event.error)
        }
        window.addEventListener("error", onError)
        const onAnimationStart = jest.fn()
        setup(
            () => () =>
                createElement(
                    "div",
                    {},
                    createElement(motion.div, {
                        id: "bad",
                        animate: { opacity: 0.5 },
                        onAnimationStart: () => {
                            throw new Error("bad callback")
                        },
                    }),
                    createElement(motion.div, {
                        id: "good",
                        animate: { opacity: 0.5 },
                        onAnimationStart,
                    })
                )
        )
        await wait(50)
        window.removeEventListener("error", onError)

        expect(onAnimationStart).toHaveBeenCalled()
        expect(errors).toHaveLength(1)
    })

    it("skips initial animations with AnimatePresence initial={false}", async () => {
        const { container } = setup(
            () => () =>
                createElement(
                    AnimatePresence,
                    { initial: false },
                    createElement(motion.div, {
                        initial: { opacity: 0 },
                        animate: { opacity: 1 },
                        transition,
                    })
                )
        )
        await wait(20)
        expect((container.firstElementChild as HTMLElement).style.opacity).toBe(
            "1"
        )
    })

    it("calls AnimatePresence onExitComplete", async () => {
        let visible = true
        const onExitComplete = jest.fn()
        const { container, update } = setup(
            () => () =>
                createElement(
                    AnimatePresence,
                    { onExitComplete },
                    visible &&
                        createElement(motion.div, {
                            key: "a",
                            style: { opacity: 1 },
                            exit: { opacity: 0 },
                            transition,
                        })
                )
        )
        await wait(20)
        visible = false
        await update()
        await wait(80)
        expect(container.firstElementChild).not.toBeNull()
        expect(onExitComplete).not.toHaveBeenCalled()

        await wait(300)
        expect(container.firstElementChild).toBeNull()
        expect(onExitComplete).toHaveBeenCalledTimes(1)
    })

    it("animates SVG attributes", async () => {
        const { container } = setup(
            () => () =>
                createElement(
                    "svg",
                    {},
                    createElement(motion.circle, {
                        initial: { cx: 0 },
                        animate: { cx: 100 },
                        transition,
                    })
                )
        )
        await wait(20)
        const circle = container.querySelector("circle")!

        await wait(400)
        expect(circle.getAttribute("cx")).toBe("100")
    })

    it("renders motion values as SVG attributes", async () => {
        const cx = motionValue(10)
        const { container } = setup(
            () => () =>
                createElement(
                    "svg",
                    {},
                    createElement(motion.circle, { cx, r: 5 })
                )
        )
        await wait(20)
        const circle = container.querySelector("circle")!
        expect(circle.getAttribute("cx")).toBe("10")

        cx.set(40)
        await wait(50)
        expect(circle.getAttribute("cx")).toBe("40")
    })

    it("renders a motion value child as text", async () => {
        const count = motionValue(1)
        const { container, update } = setup(
            () => () => jsx(motion.span, { children: count })
        )
        await wait(20)
        const span = container.firstElementChild as HTMLElement
        expect(span.textContent).toBe("1")

        count.set(2)
        await wait(50)
        expect(span.textContent).toBe("2")

        await update()
        await wait(20)
        expect(span.textContent).toBe("2")
    })
})
