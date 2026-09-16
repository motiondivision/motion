"use client"

import { animateView, ViewAnimationType } from "motion-dom"
import React, {
    ComponentType,
    PropsWithChildren,
    useInsertionEffect,
} from "react"
import { useResetViewTransitions } from "./hooks/use-reset-view-transitions"
import { sharedProps } from "./shared-props"
import { AnimateViewProps } from "./types"

type ViewTransitionEvent = (
    instance: { name: string },
    types: string[]
) => VoidFunction

interface ViewTransitionProps {
    name?: string
    onEnter: ViewTransitionEvent
    onExit: ViewTransitionEvent
    onShare: ViewTransitionEvent
    onUpdate: ViewTransitionEvent
}

// Keep the entry point importable with React 18 and its type definitions.
const ViewTransition = (
    React as unknown as {
        ViewTransition?: ComponentType<PropsWithChildren<ViewTransitionProps>>
    }
).ViewTransition

/**
 * Animate enter, exit, update and shared view transitions.
 * Requires React and React DOM 19.3 or later.
 */
export function AnimateView({
    children,
    ...props
}: PropsWithChildren<AnimateViewProps>): React.ReactElement {
    if (!ViewTransition) {
        throw new Error("AnimateView requires React 19.3 or later.")
    }

    useResetViewTransitions()
    const { name } = props

    useInsertionEffect(() => {
        if (!name) return
        sharedProps.set(name, props)
        return () => {
            if (sharedProps.get(name) === props) sharedProps.delete(name)
        }
    })

    const createAnimation =
        (type: ViewAnimationType): ViewTransitionEvent =>
        ({ name: viewName }, types) =>
            animateView(
                viewName,
                type,
                sharedProps.get(viewName) || props,
                types
            )

    return (
        <ViewTransition
            name={name}
            onEnter={createAnimation("enter")}
            onExit={createAnimation("exit")}
            onShare={createAnimation("share")}
            onUpdate={createAnimation("update")}
        >
            {children}
        </ViewTransition>
    )
}
