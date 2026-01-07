"use client"

import * as React from "react"
import { useCallback, useRef } from "react"
import type { VisualElement } from "../../render/VisualElement"
import { isRefObject } from "../../utils/is-ref-object"
import { VisualState } from "./use-visual-state"

/**
 * Set a given ref to a given value
 * This utility takes care of different types of refs: callback refs and RefObject(s)
 * Returns a cleanup function if the ref callback returns one (React 19 feature)
 */
function setRef<T>(ref: React.Ref<T>, value: T): void | (() => void) {
    if (typeof ref === "function") {
        return ref(value)
    } else if (isRefObject(ref)) {
        ;(ref as any).current = value
    }
}

/**
 * Creates a ref function that, when called, hydrates the provided
 * external ref and VisualElement.
 */
export function useMotionRef<Instance, RenderState>(
    visualState: VisualState<Instance, RenderState>,
    visualElement?: VisualElement<Instance> | null,
    externalRef?: React.Ref<Instance>
): React.Ref<Instance> {
    // Store the cleanup function from external ref if it returns one
    const externalRefCleanupRef = useRef<(() => void) | null>(null)

    return useCallback(
        (instance: Instance) => {
            if (instance) {
                visualState.onMount && visualState.onMount(instance)
            }

            if (visualElement) {
                if (instance) {
                    visualElement.mount(instance)
                } else {
                    visualElement.unmount()
                }
            }

            if (externalRef) {
                if (instance) {
                    // Mount: call the external ref and store any cleanup function
                    const cleanup = setRef(externalRef, instance)
                    if (typeof cleanup === "function") {
                        externalRefCleanupRef.current = cleanup
                    }
                } else {
                    // Unmount: call stored cleanup function if available, otherwise call ref with null
                    if (externalRefCleanupRef.current) {
                        externalRefCleanupRef.current()
                        externalRefCleanupRef.current = null
                    } else {
                        // Fallback to React <19 behavior for refs that don't return cleanup
                        setRef(externalRef, instance)
                    }
                }
            }
        },
        /**
         * Include all dependencies to ensure the callback updates correctly
         */
        [visualElement, visualState, externalRef]
    )
}
