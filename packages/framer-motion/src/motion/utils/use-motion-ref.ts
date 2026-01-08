"use client"

import * as React from "react"
import { useCallback, useInsertionEffect, useRef } from "react"
import type { VisualElement } from "../../render/VisualElement"
import { VisualState } from "./use-visual-state"

/**
 * Creates a ref function that, when called, hydrates the provided
 * external ref and VisualElement.
 */
export function useMotionRef<Instance, RenderState>(
    visualState: VisualState<Instance, RenderState>,
    visualElement?: VisualElement<Instance> | null,
    externalRef?: React.Ref<Instance>
): React.Ref<Instance> {
    /**
     * Store externalRef in a ref to avoid including it in the useCallback
     * dependency array. Including externalRef in dependencies causes issues
     * with libraries like Radix UI that create new callback refs on each render
     * when using asChild - this would cause the callback to be recreated,
     * triggering element remounts and breaking AnimatePresence exit animations.
     */
    const externalRefContainer = useRef(externalRef)
    useInsertionEffect(() => {
        externalRefContainer.current = externalRef
    })

    // Store cleanup function returned by callback refs (React 19 feature)
    const refCleanup = useRef<(() => void) | null>(null)

    return useCallback(
        (instance: Instance) => {
            if (instance) {
                visualState.onMount?.(instance)
            }

            if (visualElement) {
                instance ? visualElement.mount(instance) : visualElement.unmount()
            }

            const ref = externalRefContainer.current
            if (typeof ref === "function") {
                if (instance) {
                    const cleanup = ref(instance)
                    if (typeof cleanup === "function") {
                        refCleanup.current = cleanup
                    }
                } else if (refCleanup.current) {
                    refCleanup.current()
                    refCleanup.current = null
                } else {
                    ref(instance)
                }
            } else if (ref) {
                ;(ref as React.MutableRefObject<Instance>).current = instance
            }
        },
        [visualElement]
    )
}
