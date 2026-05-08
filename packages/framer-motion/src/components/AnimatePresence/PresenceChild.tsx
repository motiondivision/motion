"use client"

import * as React from "react"
import { useContext, useId, useMemo } from "react"
import {
    PresenceContext,
    type PresenceContextProps,
} from "../../context/PresenceContext"
import { VariantLabels } from "../../motion/types"
import { useConstant } from "../../utils/use-constant"
import { PopChild } from "./PopChild"

interface PresenceChildProps {
    children: React.ReactElement
    isPresent: boolean
    onExitComplete?: () => void
    initial?: false | VariantLabels
    custom?: any
    presenceAffectsLayout: boolean
    mode: "sync" | "popLayout" | "wait"
    anchorX?: "left" | "right"
    anchorY?: "top" | "bottom"
    root?: HTMLElement | ShadowRoot
}

export const PresenceChild = ({
    children,
    initial,
    isPresent,
    onExitComplete,
    custom,
    presenceAffectsLayout,
    mode,
    anchorX,
    anchorY,
    root
}: PresenceChildProps) => {
    const presenceChildren = useConstant(newChildrenMap)
    const id = useId()

    /**
     * Propagate the effective presence of the ancestor `AnimatePresence` chain
     * so that `usePresence` consumers in nested children become "not present"
     * when any ancestor is exiting, even without `propagate` set on the inner
     * `AnimatePresence`. Motion components continue to read the local `isPresent`
     * so their own exit-animation behaviour is unchanged.
     */
    const parentContext = useContext(PresenceContext)
    const isAncestorPresent = parentContext
        ? parentContext.isPresent &&
          (parentContext.isAncestorPresent ?? true)
        : true

    let isReusedContext = true
    let context = useMemo((): PresenceContextProps => {
        isReusedContext = false
        return {
            id,
            initial,
            isPresent,
            isAncestorPresent,
            custom,
            onExitComplete: (childId: string) => {
                presenceChildren.set(childId, true)

                for (const isComplete of presenceChildren.values()) {
                    if (!isComplete) return // can stop searching when any is incomplete
                }

                onExitComplete && onExitComplete()
            },
            register: (childId: string) => {
                presenceChildren.set(childId, false)
                return () => presenceChildren.delete(childId)
            },
        }
    }, [isPresent, isAncestorPresent, presenceChildren, onExitComplete])

    /**
     * If the presence of a child affects the layout of the components around it,
     * we want to make a new context value to ensure they get re-rendered
     * so they can detect that layout change.
     */
    if (presenceAffectsLayout && isReusedContext) {
        context = { ...context }
    }

    useMemo(() => {
        presenceChildren.forEach((_, key) => presenceChildren.set(key, false))
    }, [isPresent])

    /**
     * If there's no `motion` components to fire exit animations, we want to remove this
     * component immediately.
     */
    React.useEffect(() => {
        !isPresent &&
            !presenceChildren.size &&
            onExitComplete &&
            onExitComplete()
    }, [isPresent])

    children = (
        <PopChild pop={mode === "popLayout"} isPresent={isPresent} anchorX={anchorX} anchorY={anchorY} root={root}>
            {children}
        </PopChild>
    )

    return (
        <PresenceContext.Provider value={context}>
            {children}
        </PresenceContext.Provider>
    )
}

function newChildrenMap(): Map<string, boolean> {
    return new Map()
}
