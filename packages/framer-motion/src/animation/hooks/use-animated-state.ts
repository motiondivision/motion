"use client"

import { TargetAndTransition } from "motion-dom"
import { useLayoutEffect, useState } from "react"
import { makeUseVisualState } from "../../motion/utils/use-visual-state"
import { createBox } from "../../projection/geometry/models"
import { ResolvedValues } from "../../render/types"
import { VisualElement } from "../../render/VisualElement"
import { useConstant } from "../../utils/use-constant"
import { animateVisualElement } from "../interfaces/visual-element"

interface AnimatedStateOptions {
    initialState: ResolvedValues
}

const createObject = () => ({})

class StateVisualElement extends VisualElement<
    ResolvedValues,
    {},
    AnimatedStateOptions
> {
    type: "state"
    build() {}
    measureInstanceViewportBox = createBox
    resetTransform() {}
    restoreTransform() {}
    removeValueFromRenderState() {}
    renderInstance() {}
    scrapeMotionValuesFromProps() {
        return createObject()
    }
    getBaseTargetFromProps() {
        return undefined
    }

    readValueFromInstance(
        _state: ResolvedValues,
        key: string,
        options: AnimatedStateOptions
    ) {
        return options.initialState[key] || 0
    }

    sortInstanceNodePosition() {
        return 0
    }
}

const useVisualState = makeUseVisualState({
    scrapeMotionValuesFromProps: createObject,
    createRenderState: createObject,
})

/**
 * This is not an officially supported API and may be removed
 * on any version.
 */
export function useAnimatedState(initialState: any) {
    const [animationState, setAnimationState] = useState(initialState)
    const visualState = useVisualState({}, false)

    const element = useConstant(() => {
        return new StateVisualElement(
            {
                props: {
                    onUpdate: (v) => {
                        setAnimationState({ ...v })
                    },
                },
                visualState,
                presenceContext: null,
            },
            { initialState }
        )
    })

    useLayoutEffect(() => {
        element.mount({})
        return () => element.unmount()
    }, [element])

    const startAnimation = useConstant(
        () => (animationDefinition: TargetAndTransition) => {
            return animateVisualElement(element, animationDefinition)
        }
    )

    return [animationState, startAnimation]
}
