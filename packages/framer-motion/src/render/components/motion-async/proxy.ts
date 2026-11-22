import { createElement, forwardRef, useContext } from "react"
import { MotionConfigContext } from "../../../context/MotionConfigContext"
import type { WrapMotionComponent } from "../../../motion"
import { useConstant } from "../../../utils/use-constant"
import { animations } from "../../../motion/features/animations"
import { gestureAnimations } from "../../../motion/features/gestures"
import {
    preloadFeatures as preload,
    useAsyncFeatures,
} from "../../../motion/features/use-async-features"
import { MotionContextProps } from "../../../context/MotionContext"
import { MotionProps } from "../../../motion/types"
import { createDomVisualElement } from "../../dom/create-visual-element"
import { createMotionProxy } from "../create-proxy"
import { featureLoaders } from "./loaders"

/**
 * A config with `appear` renders the component inside one that makes its
 * enter animation as CSS. Which it is is fixed for the life of the
 * component, as it decides which hooks run.
 */
const withAppear: WrapMotionComponent = (render, isSVG) => {
    const Component = forwardRef(render)

    const renderWithAppear = (props: any, ref: any) => {
        const { appear } = useContext(MotionConfigContext)
        const Appear = useConstant(() => appear?.(Component, isSVG))

        return Appear
            ? createElement(Appear, { ...props, ref })
            : render(props, ref)
    }
    renderWithAppear.displayName = (render as any).displayName

    return renderWithAppear
}

/**
 * A motion component with animations and gestures, that fetches layout
 * and drag code the first time a component's props need it.
 *
 * Under a MotionConfig with `appear`, its enter animation runs as CSS.
 */
export const motion = /*@__PURE__*/ createMotionProxy(
    /*@__PURE__*/ Object.assign({}, animations, gestureAnimations),
    createDomVisualElement,
    (props: MotionProps, context: MotionContextProps) =>
        useAsyncFeatures(props, context, featureLoaders),
    withAppear
)

/**
 * Fetch the layout and drag features now, rather than when a component
 * first needs them. Await it in a test's setup, or call it ahead of an
 * interaction, so the first layout change or drag isn't missed.
 */
export const preloadFeatures = () => preload(featureLoaders)
