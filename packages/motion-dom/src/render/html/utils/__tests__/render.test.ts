import { HTMLRenderState } from "../../types"
import { renderHTML } from "../render"

const createRenderState = (): HTMLRenderState => ({
    transform: {},
    transformOrigin: {},
    style: { opacity: 0.5 },
    vars: { "--test": "1" },
})

describe("renderHTML", () => {
    test("renders styles and CSS variables to the element", () => {
        const element = document.createElement("div")

        renderHTML(element, createRenderState())

        expect(element.style.opacity).toBe("0.5")
        expect(element.style.getPropertyValue("--test")).toBe("1")
    })

    /**
     * In development this is caught by the "custom-component-ref" invariant at
     * mount. In production we must not take the whole render loop down. #2777
     */
    test("bails out if the instance isn't styleable", () => {
        const instance = {} as HTMLElement

        expect(() => renderHTML(instance, createRenderState())).not.toThrow()
    })
})
