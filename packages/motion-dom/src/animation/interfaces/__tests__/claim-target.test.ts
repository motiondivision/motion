import { frame } from "../../../frameloop"
import { HTMLVisualElement } from "../../../render/html/HTMLVisualElement"
import { animateElement } from "../../animate/element"
import { animateTarget } from "../visual-element-target"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

function createVisualElement() {
    return new HTMLVisualElement({
        props: {},
        presenceContext: null,
        visualState: {
            latestValues: {},
            renderState: {
                transform: {},
                transformOrigin: {},
                style: {},
                vars: {},
            },
        },
    })
}

/**
 * A renderer that animates `custom` itself, as a canvas renderer animates
 * its shader options.
 */
function claimCustom(visualElement: HTMLVisualElement) {
    const claimed = { cancel() {} } as any
    const claimTarget = jest.fn(
        (target: any, _transition: any, _delay: number, animations: any[]) => {
            delete target.custom
            animations.push(claimed)
        }
    )
    visualElement.claimTarget = claimTarget
    return { claimTarget, claimed }
}

describe("VisualElement.claimTarget", () => {
    test("animateTarget() hands it the target and transition before animating values", () => {
        const element = document.createElement("div")
        const visualElement = createVisualElement()
        visualElement.mount(element)
        const { claimTarget, claimed } = claimCustom(visualElement)

        const animations = animateTarget(visualElement, {
            custom: [{ a: 1 }],
            opacity: 0.5,
            transition: { duration: 2 },
        } as any)

        expect(claimTarget).toHaveBeenCalledTimes(1)
        const [target, transition, delay] = claimTarget.mock.calls[0]
        expect(target).toEqual({ opacity: 0.5 })
        expect(transition).toMatchObject({ duration: 2 })
        expect(delay).toBe(0)
        expect(animations).toContain(claimed)
        expect(visualElement.getValue("custom")).toBeUndefined()
        expect(visualElement.getValue("opacity")).toBeDefined()
        visualElement.unmount()
    })

    test("animate() on an element with a VisualElement hands it a copy of the keyframes", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const visualElement = createVisualElement()
        visualElement.mount(element)
        const { claimTarget, claimed } = claimCustom(visualElement)

        const keyframes = { custom: [{ a: 1 }], x: 40 } as any
        const animations = animateElement(
            element,
            keyframes,
            { duration: 0 },
            visualElement
        )

        expect(claimTarget).toHaveBeenCalledTimes(1)
        expect(claimTarget.mock.calls[0][1]).toMatchObject({ duration: 0 })
        expect(keyframes.custom).toBeDefined()
        expect(animations).toContain(claimed)
        expect(visualElement.getValue("custom")).toBeUndefined()
        await nextFrame()
        expect(visualElement.latestValues.x).toBe(40)
        visualElement.unmount()
        element.remove()
    })
})
