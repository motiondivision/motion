import { HTMLRenderState } from "../../types"
import { buildHTMLStyles } from "../build-styles"

const createRenderState = (): HTMLRenderState => ({
    style: {},
    transform: {},
    transformOrigin: {},
    vars: {},
})

describe("buildHTMLStyles", () => {
    it("composes a user transform after independent transforms", () => {
        const state = createRenderState()

        buildHTMLStyles(state, {
            scale: 2,
            transform: "rotate(90deg)",
        })

        expect(state.style.transform).toBe("scale(2) rotate(90deg)")
    })

    it("passes a composed transform to transformTemplate without adding transform to its values", () => {
        const state = createRenderState()
        const transformTemplate = jest.fn((_, generated) => generated)

        buildHTMLStyles(
            state,
            { scale: 2, transform: "rotate(90deg)" },
            transformTemplate
        )

        expect(transformTemplate).toHaveBeenCalledWith(
            { scale: 2 },
            "scale(2) rotate(90deg)"
        )
    })

    it("treats a user transform of none as absent", () => {
        const state = createRenderState()

        buildHTMLStyles(state, { scale: 2, transform: "none" })

        expect(state.style.transform).toBe("scale(2)")
    })

    it("resets transform when all transform values disappear", () => {
        const state = createRenderState()

        buildHTMLStyles(state, { transform: "rotate(90deg)" })
        buildHTMLStyles(state, {})

        expect(state.style.transform).toBe("none")
    })
})
