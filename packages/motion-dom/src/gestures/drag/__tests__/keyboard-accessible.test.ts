import { drag } from ".."
import { createElement, gesture, nextFrame, values } from "./utils"

let stops: VoidFunction[] = []

afterEach(() => {
    stops.forEach((stop) => stop())
    stops = []
    document.body.innerHTML = ""
})

async function dragFrom(element: HTMLElement, trigger: HTMLElement = element) {
    const onStart = jest.fn()
    stops.push(drag(element, { onStart }))

    const pointer = await gesture(element, trigger).to(100, 100)
    pointer.end()
    await nextFrame()

    return onStart
}

describe("keyboard accessible elements", () => {
    test.each(["button", "input", "a"])(
        "drag gesture starts on a draggable <%s>",
        async (tag) => {
            const element = createElement(tag)
            if (tag === "a") element.setAttribute("href", "#")

            const onStart = await dragFrom(element)

            expect(onStart).toBeCalledTimes(1)
            expect(values(element).x).toBeGreaterThanOrEqual(100)
        }
    )

    test.each(["input", "textarea", "select"])(
        "drag gesture does not start when pressing a child <%s>",
        async (tag) => {
            const element = createElement()
            const child = createElement(tag, element)
            if (tag === "select") {
                child.appendChild(document.createElement("option"))
            }

            const onStart = await dragFrom(element, child)

            expect(onStart).toBeCalledTimes(0)
            expect(values(element).x).toBe(0)
        }
    )

    test("drag gesture does not start when pressing a contenteditable child", async () => {
        const element = createElement()
        const child = createElement("div", element)
        child.contentEditable = "true"

        /**
         * JSDOM doesn't implement isContentEditable.
         */
        Object.defineProperty(child, "isContentEditable", { value: true })

        const onStart = await dragFrom(element, child)

        expect(onStart).toBeCalledTimes(0)
        expect(values(element).x).toBe(0)
    })

    test.each(["button", "a"])(
        "drag gesture starts when pressing a child <%s>",
        async (tag) => {
            const element = createElement()
            const child = createElement(tag, element)
            if (tag === "a") child.setAttribute("href", "#")
            child.textContent = "Click me"

            const onStart = await dragFrom(element, child)

            expect(onStart).toBeCalledTimes(1)
            expect(values(element).x).toBeGreaterThanOrEqual(100)
        }
    )
})
