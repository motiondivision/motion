"use client"

import { isMotionValue, visualElementStore } from "motion-dom"
import { invariant } from "motion-utils"
import * as React from "react"
import {
    forwardRef,
    FunctionComponent,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { ReorderContext } from "../../context/ReorderContext"
import type { MotionProxy } from "../../render/components/create-proxy"
import { HTMLMotionProps } from "../../render/html/types"
import { useConstant } from "../../utils/use-constant"
import { useMotionValue } from "../../value/use-motion-value"
import { useTransform } from "../../value/use-transform"

import { DefaultItemElement, ReorderElementTag } from "./types"
import { autoScrollIfNeeded, resetAutoScrollState } from "./utils/auto-scroll"

export interface Props<
    V,
    TagName extends ReorderElementTag = DefaultItemElement
> {
    /**
     * A HTML element to render this component as. Defaults to `"li"`.
     *
     * @public
     */
    as?: TagName

    /**
     * The value in the list that this component represents.
     *
     * @public
     */
    value: V

    /**
     * A subset of layout options primarily used to disable layout="size"
     *
     * @public
     * @default true
     */
    layout?: true | "position"
}

function useDefaultMotionValue(value: any, defaultValue: number = 0) {
    return isMotionValue(value) ? value : useMotionValue(defaultValue)
}

type ReorderItemProps<
    V,
    TagName extends ReorderElementTag = DefaultItemElement
> = Props<V, TagName> &
    Omit<HTMLMotionProps<TagName>, "value" | "layout"> &
    React.PropsWithChildren<{}>

export function ReorderItemComponent<
    V,
    TagName extends ReorderElementTag = DefaultItemElement
>(
    {
        children,
        style = {},
        value,
        as = "li" as TagName,
        onDrag,
        onDragEnd,
        onKeyDown,
        onFocus,
        onBlur,
        layout = true,
        ...props
    }: ReorderItemProps<V, TagName>,
    externalRef?: React.ForwardedRef<any>
): React.JSX.Element {
    const context = useContext(ReorderContext)

    process.env.NODE_ENV !== "production" &&
        invariant(
            Boolean(context),
            "Reorder.Item must be a child of Reorder.Group",
            "reorder-item-child"
        )

    /**
     * Render the group's kind of component, `motion` or `m`.
     */
    const Component = useConstant(
        () => context!.proxy[as as keyof MotionProxy]
    ) as FunctionComponent<
        React.PropsWithChildren<HTMLMotionProps<any> & { ref?: React.Ref<any> }>
    >

    /**
     * The group's values when this item was grabbed with the keyboard, for
     * Escape to restore. Set only while grabbed.
     */
    const [grabbedFrom, setGrabbedFrom] = useState<V[]>()
    const point = {
        x: useDefaultMotionValue(style.x),
        y: useDefaultMotionValue(style.y),
    }

    const zIndex = useTransform([point.x, point.y], ([latestX, latestY]) =>
        latestX || latestY ? 1 : "unset"
    )

    const {
        axis,
        registerItem,
        updateOrder,
        groupRef,
        hasReordered,
        isTabStop,
        setActive,
        checkTabStop,
        elements,
        onKeyDown: handleKeyDown,
    } = context!

    /**
     * Keep this item's element for the group to focus, forwarding it to
     * the external ref.
     */
    const element = useRef<HTMLElement | null>(null)
    elements.set(value, element)
    const latestRef = useRef(externalRef)
    latestRef.current = externalRef
    const ref = useConstant(() => (instance: HTMLElement | null) => {
        element.current = instance
        const ref = latestRef.current
        if (typeof ref === "function") return ref(instance)
        if (ref) ref.current = instance
    })
    useEffect(() => checkTabStop)
    const dragAxis = axis === "xy" ? true : axis

    /**
     * A keyboard grab is a drag without a pointer, so it shares whileDrag
     * (but not the drag callbacks, which need a pointer and PanInfo).
     */
    const grab = (element: Element, from?: V[]) => {
        setGrabbedFrom(from)
        visualElementStore
            .get(element)
            ?.animationState?.setActive("whileDrag", !!from)
    }

    return (
        <Component
            drag={dragAxis}
            tabIndex={isTabStop(value) ? 0 : -1}
            {...props}
            dragSnapToOrigin
            style={{ ...style, x: point.x, y: point.y, zIndex }}
            layout={layout}
            onDrag={(event, gesturePoint) => {
                const { velocity, point: pointerPoint } = gesturePoint
                const offset = { x: point.x.get(), y: point.y.get() }

                updateOrder(value, offset, velocity)

                const scrollAxis =
                    axis === "xy"
                        ? Math.abs(velocity.x) > Math.abs(velocity.y)
                            ? "x"
                            : "y"
                        : axis
                autoScrollIfNeeded(
                    groupRef.current,
                    pointerPoint[scrollAxis],
                    scrollAxis,
                    velocity[scrollAxis]
                )

                onDrag && onDrag(event, gesturePoint)
            }}
            onDragEnd={(event, gesturePoint) => {
                // Runs a frame after release, so after the release's click
                hasReordered.current = false
                resetAutoScrollState()
                onDragEnd && onDragEnd(event, gesturePoint)
            }}
            onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
                onKeyDown?.(event as any)
                handleKeyDown(event, value, grabbedFrom, grab)
            }}
            /**
             * The item focused last, or holding focus, is the group's tab
             * stop.
             */
            onFocus={(event: React.FocusEvent<HTMLElement>) => {
                onFocus?.(event as any)
                setActive(value)
            }}
            /**
             * A move blurs the item, but that blur is never dispatched:
             * React DOM disables its events while it commits, and restores
             * focus to the item before re-enabling them. So any blur that
             * reaches here is focus really leaving, which drops the item.
             */
            onBlur={(event: React.FocusEvent<HTMLElement>) => {
                onBlur?.(event as any)
                grabbedFrom && grab(event.currentTarget)
            }}
            onLayoutMeasure={(measured) => {
                registerItem(value, measured)
            }}
            ref={ref}
            ignoreStrict
        >
            {children}
        </Component>
    )
}

export const ReorderItem = /*@__PURE__*/ forwardRef(ReorderItemComponent) as <
    V,
    TagName extends ReorderElementTag = DefaultItemElement
>(
    props: ReorderItemProps<V, TagName> & { ref?: React.ForwardedRef<any> }
) => ReturnType<typeof ReorderItemComponent>
