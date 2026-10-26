/**
 * @jest-environment node
 */
import { ObjectVisualElement } from "../../../../render/object/ObjectVisualElement"
import { motionValue } from "../../../../value"
import { canGroupTransform } from "../../transforms/TransformAnimation"
import { supportsBrowserAnimation } from "../waapi"

/**
 * Motion values owned by a non-DOM renderer, in an environment without the
 * DOM's element classes. React Native defines HTMLElement and Element as
 * its own element nodes, but not SVGElement. Node defines none of them.
 */
function createOptions(name: string) {
    const owner = new ObjectVisualElement(
        {
            props: {},
            presenceContext: null,
            visualState: { latestValues: {}, renderState: { output: {} } },
        } as any,
        {} as any
    )
    owner.mount({})

    return {
        keyframes: [0, 1],
        name,
        motionValue: motionValue(0, { owner }),
    } as any
}

const globals = globalThis as any

describe("acceleration checks outside the DOM", () => {
    afterEach(() => {
        delete globals.HTMLElement
        delete globals.Element
    })

    test("don't throw without DOM element classes", () => {
        expect(supportsBrowserAnimation(createOptions("opacity"))).toBe(false)
        expect(canGroupTransform(createOptions("x"))).toBeFalsy()
    })

    test("don't throw with React Native's element globals", () => {
        globals.HTMLElement = class {}
        globals.Element = class {}

        expect(supportsBrowserAnimation(createOptions("opacity"))).toBe(false)
        expect(canGroupTransform(createOptions("x"))).toBeFalsy()
    })
})
