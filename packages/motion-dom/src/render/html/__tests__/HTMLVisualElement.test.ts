import { motionValue } from "../../../value"
import { HTMLVisualElement } from "../HTMLVisualElement"

const createVisualElement = (element: HTMLElement) => {
    const visualElement = new HTMLVisualElement({
        props: {},
        presenceContext: null,
        visualState: {
            latestValues: {},
            renderState: {
                style: {},
                vars: {},
                transform: {},
                transformOrigin: {},
            },
        },
    } as any)
    visualElement.mount(element)
    return visualElement
}

describe("HTMLVisualElement.readValue", () => {
    test("parses numerical strings into numbers", () => {
        const element = document.createElement("div")
        element.style.opacity = "0.5"
        expect(createVisualElement(element).readValue("opacity", 1)).toBe(0.5)
    })

    test("leaves animatable values as read", () => {
        const element = document.createElement("div")
        element.style.backgroundColor = "rgb(255, 0, 0)"
        element.style.width = "100px"
        const visualElement = createVisualElement(element)

        expect(visualElement.readValue("backgroundColor", "#fff")).toBe(
            "rgb(255, 0, 0)"
        )
        expect(visualElement.readValue("width", "50%")).toBe("100px")
    })

    test("replaces unanimatable values with an animatable none for the target", () => {
        const element = document.createElement("div")
        element.style.boxShadow = "none"
        const visualElement = createVisualElement(element)

        expect(visualElement.readValue("boxShadow", "10px 20px #000")).toBe(
            "0px 0px rgba(0, 0, 0, 0)"
        )
        // Numerical targets can't provide a template, so the value is kept
        expect(visualElement.readValue("boxShadow", 10)).toBe("none")
    })

    test("prefers latest values over the DOM", () => {
        const element = document.createElement("div")
        element.style.width = "100px"
        const visualElement = createVisualElement(element)
        visualElement.latestValues.width = 200

        expect(visualElement.readValue("width", "50%")).toBe(200)
    })
})

describe("HTMLVisualElement.addValue", () => {
    test("doesn't render a value until it has resolved", () => {
        const visualElement = createVisualElement(document.createElement("div"))
        const x = motionValue<number | undefined>(undefined)
        visualElement.addValue("x", x as any)

        expect("x" in visualElement.latestValues).toBe(false)

        x.set(5)
        expect(visualElement.latestValues.x).toBe(5)
    })
})
