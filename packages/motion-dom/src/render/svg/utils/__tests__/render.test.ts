import { buildSVGAttrs } from "../build-attrs"
import { renderSVG } from "../render"
import { SVGRenderState } from "../../types"

function createState(): SVGRenderState {
    return {
        style: {},
        vars: {},
        transform: {},
        transformOrigin: {},
        attrs: {},
    }
}

describe("buildSVGAttrs opacity", () => {
    test("keeps opacity as a CSS style, not an SVG attribute", () => {
        const state = createState()

        buildSVGAttrs(state, { opacity: 0.5, cx: 10 }, false)

        expect(state.style.opacity).toBe(0.5)
        expect(state.attrs.opacity).toBeUndefined()
        expect(state.attrs.cx).toBe(10)
    })
})

describe("renderSVG opacity", () => {
    test("writes opacity to style so WAAPI and JS render share a target", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "foreignObject"
        )
        element.style.opacity = "0"

        const state = createState()
        state.style.opacity = 1

        renderSVG(element, state)

        expect(element.style.opacity).toBe("1")
        expect(element.getAttribute("opacity")).toBeNull()
    })
})
