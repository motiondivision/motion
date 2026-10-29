import { createElement, createRoot } from "remix/component"
import type { Handle } from "remix/component"
import { motion, motionScope } from "../remix"

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

    it("runs and cancels a motionScope with its element", async () => {
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
                            mix: motionScope(scopeSetup),
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
})
