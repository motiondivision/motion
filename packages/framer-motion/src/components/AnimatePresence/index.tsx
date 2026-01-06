"use client"

import * as React from "react"
import { useContext, useMemo, useRef, useState } from "react"
import { LayoutGroupContext } from "../../context/LayoutGroupContext"
import { useConstant } from "../../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../../utils/use-isomorphic-effect"
import { PresenceChild } from "./PresenceChild"
import { AnimatePresenceProps } from "./types"
import { usePresence } from "./use-presence"
import { ComponentKey, getChildKey, onlyElements } from "./utils"

/**
 * `AnimatePresence` enables the animation of components that have been removed from the tree.
 *
 * When adding/removing more than a single child, every child **must** be given a unique `key` prop.
 *
 * Any `motion` components that have an `exit` property defined will animate out when removed from
 * the tree.
 *
 * ```jsx
 * import { motion, AnimatePresence } from 'framer-motion'
 *
 * export const Items = ({ items }) => (
 *   <AnimatePresence>
 *     {items.map(item => (
 *       <motion.div
 *         key={item.id}
 *         initial={{ opacity: 0 }}
 *         animate={{ opacity: 1 }}
 *         exit={{ opacity: 0 }}
 *       />
 *     ))}
 *   </AnimatePresence>
 * )
 * ```
 *
 * You can sequence exit animations throughout a tree using variants.
 *
 * If a child contains multiple `motion` components with `exit` props, it will only unmount the child
 * once all `motion` components have finished animating out. Likewise, any components using
 * `usePresence` all need to call `safeToRemove`.
 *
 * @public
 */
export const AnimatePresence = ({
    children,
    custom,
    initial = true,
    onExitComplete,
    presenceAffectsLayout = true,
    mode = "sync",
    propagate = false,
    anchorX = "left",
    root
}: React.PropsWithChildren<AnimatePresenceProps>) => {
    const [isParentPresent, safeToRemove] = usePresence(propagate)

    /**
     * Filter any children that aren't ReactElements. We can only track components
     * between renders with a props.key.
     */
    const presentChildren = useMemo(() => onlyElements(children), [children])

    /**
     * Track the keys of the currently rendered children. This is used to
     * determine which children are exiting.
     */
    const presentKeys =
        propagate && !isParentPresent ? [] : presentChildren.map(getChildKey)

    /**
     * If `initial={false}` we only want to pass this to components in the first render.
     */
    const isInitialRender = useRef(true)

    /**
     * A ref containing the currently present children. When all exit animations
     * are complete, we use this to re-render the component with the latest children
     * *committed* rather than the latest children *rendered*.
     */
    const pendingPresentChildren = useRef(presentChildren)

    /**
     * Track which exiting children have finished animating out.
     */
    const exitComplete = useConstant(() => new Map<ComponentKey, boolean>())

    /**
     * Track which components are currently processing exit to prevent duplicate processing.
     */
    const exitingComponents = useRef(new Set<ComponentKey>())

    /**
     * Save children to render as React state. To ensure this component is concurrent-safe,
     * we check for exiting children via an effect.
     */
    const [diffedChildren, setDiffedChildren] = useState(presentChildren)
    const [renderedChildren, setRenderedChildren] = useState(presentChildren)

    useIsomorphicLayoutEffect(() => {
        isInitialRender.current = false
        pendingPresentChildren.current = presentChildren

        /**
         * Update complete status of exiting children.
         */
        for (let i = 0; i < renderedChildren.length; i++) {
            const key = getChildKey(renderedChildren[i])

            if (!presentKeys.includes(key)) {
                if (exitComplete.get(key) !== true) {
                    exitComplete.set(key, false)
                }
            } else {
                exitComplete.delete(key)
                exitingComponents.current.delete(key)
            }
        }
    }, [renderedChildren, presentKeys.length, presentKeys.join("-")])

    const exitingChildren: any[] = []

    if (presentChildren !== diffedChildren) {
        let nextChildren = [...presentChildren]

        /**
         * Loop through all the currently rendered components and decide which
         * are exiting.
         */
        for (let i = 0; i < renderedChildren.length; i++) {
            const child = renderedChildren[i]
            const key = getChildKey(child)

            if (!presentKeys.includes(key)) {
                nextChildren.splice(i, 0, child)
                exitingChildren.push(child)
            }
        }

        /**
         * If we're in "wait" mode, and we have exiting children, we want to
         * only render these until they've all exited.
         */
        if (mode === "wait" && exitingChildren.length) {
            nextChildren = exitingChildren
        }

        setRenderedChildren(onlyElements(nextChildren))
        setDiffedChildren(presentChildren)

        /**
         * Early return to ensure once we've set state with the latest diffed
         * children, we can immediately re-render.
         */
        return null
    }

    if (
        process.env.NODE_ENV !== "production" &&
        mode === "wait" &&
        renderedChildren.length > 1
    ) {
        console.warn(
            `You're attempting to animate multiple children within AnimatePresence, but its mode is set to "wait". This will lead to odd visual behaviour.`
        )
    }

    /**
     * If we've been provided a forceRender function by the LayoutGroupContext,
     * we can use it to force a re-render amongst all surrounding components once
     * all components have finished animating out.
     */
    const { forceRender } = useContext(LayoutGroupContext)

    return (
        <>
            {renderedChildren.map((child) => {
                const key = getChildKey(child)

                const isPresent =
                    propagate && !isParentPresent
                        ? false
                        : presentChildren === renderedChildren ||
                          presentKeys.includes(key)

                const onExit = () => {
                    if (exitingComponents.current.has(key)) {
                        return
                    }
                    exitingComponents.current.add(key)

                    if (exitComplete.has(key)) {
                        exitComplete.set(key, true)
                    } else {
                        return
                    }

                    let isEveryExitComplete = true
                    exitComplete.forEach((isExitComplete) => {
                        if (!isExitComplete) isEveryExitComplete = false
                    })

                    if (isEveryExitComplete) {
                        forceRender?.()
                        setRenderedChildren(pendingPresentChildren.current)

                        propagate && safeToRemove?.()

                        onExitComplete && onExitComplete()
                    }
                }

                return (
                    <PresenceChild
                        key={key}
                        isPresent={isPresent}
                        initial={
                            !isInitialRender.current || initial
                                ? undefined
                                : false
                        }
                        custom={custom}
                        presenceAffectsLayout={presenceAffectsLayout}
                        mode={mode}
                        root={root}
                        onExitComplete={isPresent ? undefined : onExit}
                        anchorX={anchorX}
                    >
                        {child}
                    </PresenceChild>
                )
            })}
        </>
    )
}
