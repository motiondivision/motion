"use client"

import {
    createElement,
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    type HTMLAttributes,
} from "react"
import type { FXShader } from "./canvas/effects"
import { defineMotionFX, type MotionFXElement } from "./canvas/element"

export interface MotionFXProps extends HTMLAttributes<HTMLElement> {
    /**
     * Shaders run in order on everything inside, and `motionBlur()`.
     *
     * ```jsx
     * <MotionFX shaders={[motionBlur(), chromaticAberration()]}>
     *   <motion.div animate={{ x: 400 }} />
     * </MotionFX>
     * ```
     */
    shaders?: FXShader[]
}

/**
 * `<motion-fx>` for React. Its direct children are drawn in a canvas,
 * where they can have motion blur and shaders. Without HTML-in-canvas
 * they're displayed as normal DOM.
 */
export const MotionFX = /*@__PURE__*/ forwardRef<
    MotionFXElement,
    MotionFXProps
>(function MotionFX({ shaders, className, ...props }, ref) {
    const element = useRef<MotionFXElement>(null)

    useImperativeHandle(ref, () => element.current!, [])

    useEffect(() => defineMotionFX(), [])

    useEffect(() => {
        element.current!.shaders = shaders || []
    })

    return createElement("motion-fx", {
        ...props,
        class: className,
        ref: element,
    })
})
