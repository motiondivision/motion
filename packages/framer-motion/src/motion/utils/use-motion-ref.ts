"use client"

import * as React from "react"
import { useCallback } from "react"
import type { VisualElement } from "../../render/VisualElement"
import { isRefObject } from "../../utils/is-ref-object"
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
                if (typeof externalRef === "function") {
                    externalRef(instance)
                } else if (isRefObject(externalRef)) {
                    ;(externalRef as any).current = instance
                }
            }
        },
        /**
         * Include externalRef in dependencies to ensure the callback updates
         * when the ref changes, allowing proper ref forwarding.
         */
        [visualElement]
    )
}
