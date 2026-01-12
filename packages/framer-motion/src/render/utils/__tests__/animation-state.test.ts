import { createAnimationState, type AnimationState, type VisualElement } from "motion-dom"
import { MotionProps } from "../../../motion/types"
import { createHtmlRenderState } from "../../html/utils/create-render-state"
import { StateVisualElement } from "./StateVisualElement"

function createTest(
    props: MotionProps = {},
    parent: VisualElement<any> | undefined = undefined
): { element: VisualElement; state: any } {
    const element = new StateVisualElement(
        {
            props,
            parent,
            presenceContext: null,
            visualState: {
                latestValues: {},
                renderState: createHtmlRenderState(),
            },
        },
        {
            initialState: {},
        }
    )
    element.animationState = createAnimationState(element)

    element.mount({})

    return {
        element: element,
        state: {
            ...element.animationState,
            update(newProps: any, type: any, animateChanges = true): any {
                element.update(newProps, null)
                return animateChanges === true
                    ? element.animationState?.animateChanges(type)
                    : undefined
            },
        },
    }
}

function mockAnimate(state: AnimationState) {
    const mocked = jest.fn()
    state.setAnimateFunction(() => {
        return (animations: any) => {
            mocked(animations.map(({ animation }: any) => animation))
        }
    })
    return mocked
}

describe("Animation state - Initiating props", () => {
    test("Initial animation", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            animate: { opacity: 1 },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).toBeCalledWith([{ opacity: 1 }])
    })

    test("Initial animation with prop as variant", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            animate: "test",
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).toBeCalledWith(["test"])
    })

    test("Initial animation with prop as variant list", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            animate: ["test", "heyoo"],
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).toBeCalledWith(["test", "heyoo"])
    })

    test("Initial animation with prop as inherited variant", () => {
        const { element: parent } = createTest({
            animate: "test",
        })
        const { element: child, state } = createTest({}, parent)
        child.manuallyAnimateOnMount = false

        const animate = mockAnimate(state)
        state.update({
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).not.toBeCalled()
    })

    test("Initial animation with initial=false", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            initial: false,
            animate: { opacity: 1 },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).not.toBeCalled()
    })

    test("Initial animation with prop as variant with initial=false", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            initial: false,
            animate: "test",
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).not.toBeCalled()
    })

    test("Initial animation with prop as variant when initial === animate", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            initial: "test",
            animate: "test",
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).not.toBeCalled()
    })

    test("Initial animation with prop as variant list with initial=false", () => {
        const { state } = createTest()

        const animate = mockAnimate(state)
        state.update({
            initial: false,
            animate: ["test", "heyoo"],
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(animate).not.toBeCalled()
    })
})

describe("Animation state - Setting props", () => {
    test("No change, target", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: 1 },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: { opacity: 1 },
        })

        expect(animate).not.toBeCalled()
        expect(state.getState()["animate"].protectedKeys).toEqual({
            opacity: true,
        })
    })
    test("No change, target keyframes", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: [0, 1] },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: { opacity: [0, 1] },
        })

        expect(animate).not.toBeCalled()
        expect(state.getState()["animate"].protectedKeys).toEqual({
            opacity: true,
        })
    })

    test("No change, variant", () => {
        const { state } = createTest()

        state.update({
            animate: "test",
            variants: {
                test: { opacity: 1 },
            },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: "test",
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(animate).not.toBeCalled()
        expect(state.getState()["animate"].protectedKeys).toEqual({
            opacity: true,
        })
    })

    test("No change, variant list", () => {
        const { state } = createTest()

        state.update({
            animate: ["test", "test2"],
            variants: {
                test: { opacity: 1 },
            },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: ["test", "test2"],
            variants: {
                test: { opacity: 1 },
            },
        })

        expect(animate).not.toBeCalled()
        expect(state.getState()["animate"].protectedKeys).toEqual({
            opacity: true,
        })
    })

    test("Change single value, target", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: 1 },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: { opacity: 0 },
        })

        expect(animate).toBeCalledWith([{ opacity: 0 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Change single value, keyframes", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: [0, 1] },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: { opacity: [0.5, 1] },
        })

        expect(animate).toBeCalledWith([{ opacity: [0.5, 1] }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Change single value, variant", () => {
        const { state } = createTest()

        state.update({
            animate: "a",
            variants: {
                a: { opacity: 0 },
                b: { opacity: 1 },
            },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: "b",
            variants: {
                a: { opacity: 0 },
                b: { opacity: 1 },
            },
        })

        expect(animate).toBeCalledWith(["b"])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Change single value, variant list", () => {
        const { state } = createTest()

        state.update({
            animate: ["a"],
            variants: {
                a: { opacity: 0 },
                b: { opacity: 1 },
            },
        })

        const animate = mockAnimate(state)

        state.update({
            animate: ["b"],
            variants: {
                a: { opacity: 0 },
                b: { opacity: 1 },
            },
        })

        expect(animate).toBeCalledWith(["b"])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Swap between value in target and transitionEnd, target", () => {
        const { state } = createTest()

        state.update({
            style: { opacity: 0.1 },
            animate: { opacity: 0.2 },
        })

        let animate = mockAnimate(state)

        state.update({
            style: { opacity: 0.1 },
            animate: { transitionEnd: { opacity: 0.3 } },
        })

        expect(animate).toBeCalledWith([{ transitionEnd: { opacity: 0.3 } }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})

        animate = mockAnimate(state)

        state.update({
            style: { opacity: 0.1 },
            animate: { opacity: 0.2 },
        })
        expect(animate).toBeCalledWith([{ opacity: 0.2 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Change single value, target, with unchanging values", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: 1, x: 0 },
        })

        let animate = mockAnimate(state)

        state.update({
            animate: { opacity: 0, x: 0 },
        })

        expect(animate).toBeCalledWith([{ opacity: 0, x: 0 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({
            x: true,
        })

        animate = mockAnimate(state)

        state.update({
            animate: { opacity: 0, x: 100 },
        })

        expect(animate).toBeCalledWith([{ opacity: 0, x: 100 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({
            opacity: true,
        })
    })

    test("Removing values, target changed", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: 1 },
        })

        const animate = mockAnimate(state)

        state.update({
            style: { opacity: 0 },
            animate: {},
        })

        expect(animate).toBeCalledWith([{ opacity: 0 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Removing values, target undefined", () => {
        const { state } = createTest()

        state.update({
            animate: { opacity: 1 },
        })

        const animate = mockAnimate(state)

        state.update({
            style: { opacity: 0 },
            animate: undefined,
        })

        expect(animate).toBeCalledWith([{ opacity: 0 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Removing values, variant changed", () => {
        const { state } = createTest()

        state.update({
            animate: "a",
            variants: {
                a: { opacity: 0 },
                b: { x: 1 },
            },
        })

        const animate = mockAnimate(state)

        state.update({
            style: { opacity: 1 },
            animate: "b",
            variants: {
                a: { opacity: 0 },
                b: { x: 1 },
            },
        })

        expect(animate).toBeCalledWith(["b", { opacity: 1 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Removing values, inherited variant changed", () => {
        const { element: parent } = createTest({ animate: "a" })
        const { state } = createTest({}, parent)

        state.update({
            variants: {
                a: { opacity: 0 },
                b: { x: 1 },
            },
        })

        const animate = mockAnimate(state)
        parent.update({ animate: "b" }, null)
        state.update(
            {
                style: { opacity: 1 },
                variants: {
                    a: { opacity: 0 },
                    b: { x: 1 },
                },
            },
            null
        )

        expect(animate).toBeCalledWith([{ opacity: 1 }])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
    })

    test("Removing values, inherited variant changed from starting at empty variant", () => {
        const { element: parent, state: parentState } = createTest({
            animate: "",
        })
        const { element: child, state: childState } = createTest({}, parent)
        child.manuallyAnimateOnMount = false
        childState.update(
            {
                style: { opacity: 0 },
                variants: {
                    a: { opacity: 0.1 },
                    b: { opacity: 0.9 },
                },
            },
            undefined,
            undefined,
            false
        )

        let parentAnimate = mockAnimate(parentState)
        let childAnimate = mockAnimate(childState)

        childState.update(
            {
                style: { opacity: 0 },
                variants: {
                    a: { opacity: 0.1 },
                    b: { opacity: 0.9 },
                },
            },
            undefined,
            undefined,
            false
        )
        parentState.update({ animate: "a" }, undefined, undefined, false)
        child.animationState!.animateChanges()
        parent.animationState!.animateChanges()

        expect(parentAnimate).toBeCalledWith(["a"])
        expect(childAnimate).not.toBeCalled()
        expect(childState.getState()["animate"].protectedKeys).toEqual({})

        parentAnimate = mockAnimate(parentState)
        childAnimate = mockAnimate(childState)

        childState.update(
            {
                style: { opacity: 0 },
                variants: {
                    a: { opacity: 0.1 },
                    b: { opacity: 0.9 },
                },
            },
            undefined,
            undefined,
            false
        )
        parentState.update({ animate: "b" }, undefined, undefined, false)

        child.animationState!.animateChanges()
        parent.animationState!.animateChanges()
        expect(parentAnimate).toBeCalledWith(["b"])
        expect(childAnimate).not.toBeCalled()
        expect(childState.getState()["animate"].protectedKeys).toEqual({})

        parentAnimate = mockAnimate(parentState)
        childAnimate = mockAnimate(childState)

        childState.update(
            {
                style: { opacity: 0 },
                variants: {
                    a: { opacity: 0.1 },
                    b: { opacity: 0.9 },
                },
            },
            undefined,
            undefined,
            false
        )
        parentState.update({ animate: "" }, undefined, undefined, false)

        child.animationState!.animateChanges()
        parent.animationState!.animateChanges()
        expect(parentAnimate).toBeCalledWith([""])
        expect(childAnimate).toBeCalledWith([{ opacity: 0 }])
        expect(childState.getState()["animate"].protectedKeys).toEqual({})
    })
})

describe("Animation state - Set active", () => {
    test("Change active state while props are the same", () => {
        const { state } = createTest()

        state.update({
            style: { opacity: 0 },
            animate: { opacity: 1 },
            whileHover: { opacity: 0.5 },
            whileTap: { opacity: 0.8 },
        })

        // Set hover to true
        let animate = mockAnimate(state)
        state.setActive("whileHover", true)
        expect(animate).toBeCalledWith([{ opacity: 0.5 }])

        // Set hover to false
        animate = mockAnimate(state)
        state.setActive("whileHover", false)
        expect(animate).toBeCalledWith([{ opacity: 1 }])

        // Set hover to true
        animate = mockAnimate(state)
        state.setActive("whileHover", true)
        expect(animate).toBeCalledWith([{ opacity: 0.5 }])

        // Set hover to false
        animate = mockAnimate(state)
        state.setActive("whileHover", false)
        expect(animate).toBeCalledWith([{ opacity: 1 }])

        // Set hover to true
        animate = mockAnimate(state)
        state.setActive("whileHover", true)
        expect(animate).toBeCalledWith([{ opacity: 0.5 }])

        // Set press to true
        animate = mockAnimate(state)
        state.setActive("whileTap", true)
        expect(animate).toBeCalledWith([{ opacity: 0.8 }])

        // Set hover to false
        animate = mockAnimate(state)
        state.setActive("whileHover", false)
        expect(animate).not.toBeCalled()

        // Set press to false
        animate = mockAnimate(state)
        state.setActive("whileTap", false)
        expect(animate).toBeCalledWith([{ opacity: 1 }])
    })

    test("Change active variant where no variants are defined", () => {
        /**
         * We should still animate back to lower-priority variants in case children need animating to
         */
        const { state } = createTest()

        state.update({
            animate: "a",
            whileHover: "b",
        })

        // Set hover to true
        let animate = mockAnimate(state)
        state.setActive("whileHover", true)
        expect(animate).toBeCalledWith(["b"])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(state.getState()["whileHover"].protectedKeys).toEqual({})

        // Set hover to false
        animate = mockAnimate(state)
        state.setActive("whileHover", false)
        expect(animate).toBeCalledWith(["a"])
        expect(state.getState()["animate"].protectedKeys).toEqual({})
        expect(state.getState()["whileHover"].protectedKeys).toEqual({})
    })
})
