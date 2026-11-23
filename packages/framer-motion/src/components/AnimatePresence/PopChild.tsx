"use client"

import { isHTMLElement, microtask, type VisualElement } from "motion-dom"
import * as React from "react"
import { useContext, useId, useInsertionEffect, useRef } from "react"

import { MotionConfigContext } from "../../context/MotionConfigContext"
import { useComposedRefs } from "../../utils/use-composed-ref"

interface Size {
    width: number
    height: number
    top: number
    left: number
    right: number
    bottom: number
    direction: string
    point?: number[]
}

interface Props {
    children: React.ReactElement
    isPresent: boolean
    anchorX?: "left" | "right"
    anchorY?: "top" | "bottom"
    root?: HTMLElement | ShadowRoot
    pop?: boolean
    popNode?: React.RefObject<VisualElement | undefined>
}

interface MeasureProps extends Props {
    getElement: () => unknown
    sizeRef: React.RefObject<Size>
}

/**
 * How much an element's transforms, and its ancestors', scale it on screen.
 */
const measureScale = (element?: HTMLElement | null) => {
    const { width, height } =
        element?.getBoundingClientRect() || ({} as DOMRect)
    return [
        width / element?.offsetWidth! || 1,
        height / element?.offsetHeight! || 1,
    ]
}

/**
 * The element's position in the space it scrolls in, as the projection
 * system measures it (see measurePageBox and removeElementScroll): its
 * viewport position, plus its scroll containers' scroll (across shadow
 * roots), plus the window's (the root's) scroll. Like checkIsScrollRoot, a
 * fixed ancestor is a scroll root: it doesn't scroll with anything above it,
 * so a fixed container is measured relative to the viewport.
 *
 * So a scroll position clamped by content shrinking reads as the element
 * moving only if it doesn't scroll with that content.
 *
 * Scroll offsets are in their container's coordinate space, so are scaled
 * onto the screen, and the result is returned in the offsetParent's
 * coordinate space, which the pop rule's offsets are in.
 */
const measurePoint = (element: HTMLElement) => {
    let { left, top } = element.getBoundingClientRect()
    let node: HTMLElement | null | undefined = element
    while (
        (node = (node.parentElement ||
            (node.parentNode as ShadowRoot)?.host) as HTMLElement | null)
    ) {
        const { scrollLeft, scrollTop } = node
        if (scrollLeft || scrollTop) {
            const [x, y] = measureScale(node)
            left += scrollLeft * x
            top += scrollTop * y
        }
        if (getComputedStyle(node).position === "fixed") break
    }
    const [x, y] = measureScale(element.offsetParent as HTMLElement | null)
    return [left / x, top / y]
}

/**
 * Measurement functionality has to be within a separate component
 * to leverage snapshot lifecycle.
 */
class PopChildMeasure extends React.Component<MeasureProps> {
    getSnapshotBeforeUpdate(prevProps: MeasureProps) {
        const element = this.props.getElement()
        if (isHTMLElement(element) && prevProps.isPresent && !this.props.isPresent && this.props.pop !== false) {
            const parent = element.offsetParent
            const parentWidth = isHTMLElement(parent)
                ? parent.offsetWidth || 0
                : 0
            const parentHeight = isHTMLElement(parent)
                ? parent.offsetHeight || 0
                : 0

            const computedStyle = getComputedStyle(element)
            const size = this.props.sizeRef.current!
            size.height = parseFloat(computedStyle.height)
            size.width = parseFloat(computedStyle.width)
            size.top = element.offsetTop
            size.left = element.offsetLeft
            size.right = parentWidth - size.width - size.left
            size.bottom = parentHeight - size.height - size.top
            size.direction = computedStyle.direction
            size.point = measurePoint(element)
        }

        return null
    }

    /**
     * Required with getSnapshotBeforeUpdate to stop React complaining.
     */
    componentDidUpdate() {}

    render() {
        return this.props.children
    }
}

export function PopChild({ children, isPresent, anchorX, anchorY, root, pop, popNode }: Props) {
    const id = useId()
    const ref = useRef<HTMLElement>(null)
    const size = useRef<Size>({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        direction: "ltr",
    })
    const { nonce } = useContext(MotionConfigContext)
    /**
     * In React 19, refs are passed via props.ref instead of element.ref.
     * We check props.ref first (React 19) and fall back to element.ref (React 18).
     *
     * The composed ref is only used when popping the child out (pop !== false),
     * so we avoid reading children.props.ref otherwise. In React 18.3 that read
     * triggers a spurious "`ref` is not a prop" warning getter (#3745).
     */
    const childRef =
        pop !== false
            ? ((children.props as { ref?: React.Ref<HTMLElement> })?.ref ??
              (children as unknown as { ref?: React.Ref<HTMLElement> })?.ref)
            : undefined
    const composedRef = useComposedRefs(ref, childRef)

    /**
     * The child's element: the one our ref reached or, if the child can't
     * be given a ref (for instance a function component that doesn't
     * forward it), its outermost motion component's element (#2503).
     */
    const getElement = () =>
        ref.current || (popNode?.current?.current as HTMLElement | undefined)

    const insertPopRule = (sheet: CSSStyleSheet | null) => {
        const { width, height, top, left, right, bottom, direction } = size.current
        const isRTL = direction === "rtl"
        const x = anchorX === "left"
            ? (isRTL ? `right:${right}` : `left:${left}`)
            : (isRTL ? `left:${left}` : `right:${right}`)
        const y = anchorY === "bottom" ? `bottom:${bottom}` : `top:${top}`

        sheet?.insertRule(
            `[data-motion-pop-id="${id}"]{position:absolute!important;width:${width}px!important;height:${height}px!important;${x}px!important;${y}px!important}`
        )
    }

    /**
     * We create and inject a style block so we can apply this explicit
     * sizing in a non-destructive manner by just deleting the style block.
     *
     * We can't apply size via render as the measurement happens
     * in getSnapshotBeforeUpdate (post-render), likewise if we apply the
     * styles directly on the DOM node, we might be overwriting
     * styles set via the style prop.
     */
    useInsertionEffect(() => {
        const { width, height } = size.current
        const element = getElement()
        if (isPresent || !element) return

        /**
         * An exiting element can't be focused, clicked or read by
         * assistive tech. Unless it already was, it stops being inert if
         * it re-enters.
         */
        const wasInert = element.hasAttribute("inert")
        const restoreInert = () => {
            wasInert || element.removeAttribute("inert")
        }
        element.setAttribute("inert", "")

        if (pop === false || !width || !height) return restoreInert

        element.dataset.motionPopId = id

        /**
         * Use the element's own document so this works when rendering
         * into another window or iframe (e.g. via window.open()).
         */
        const doc = element.ownerDocument
        const style = doc.createElement("style")
        if (nonce) style.nonce = nonce

        const parent = root ?? doc.head
        parent.appendChild(style)

        insertPopRule(style.sheet)

        /**
         * Popping the element out of the layout can move its offsetParent,
         * which we've pinned it to. For instance, a bottom-anchored or
         * centred container shrinks around its remaining children (#2348).
         * So once the whole commit is in the DOM, measure how far the
         * element moved and offset it back.
         *
         * This runs on the microtask frameloop, so before paint even if
         * this commit happens within an animation frame. Every popped
         * element is measured in its first step, then corrected at the
         * start of the read step: before the projection system, which
         * schedules its layout measurement there from layout effects, so
         * layout animations see the corrected position.
         */
        let dx = 0
        let dy = 0
        microtask.setup(() => {
            const [x, y] = measurePoint(element)
            dx = size.current.point![0] - x
            dy = size.current.point![1] - y
        })
        microtask.read(() => {
            /**
             * The style has no sheet if it's been removed since, because
             * the element is present again.
             */
            const { sheet } = style
            if (!sheet || (!dx && !dy)) return
            const s = size.current
            s.left += dx
            s.right -= dx
            s.top += dy
            s.bottom -= dy
            sheet.deleteRule(0)
            insertPopRule(sheet)
        })

        return () => {
            restoreInert()
            element.removeAttribute("data-motion-pop-id")
            if (parent.contains(style)) {
                parent.removeChild(style)
            }
        }
    }, [isPresent])

    return (
        <PopChildMeasure isPresent={isPresent} getElement={getElement} sizeRef={size} pop={pop}>
            {pop === false
                ? children
                : React.cloneElement(children as any, { ref: composedRef })}
        </PopChildMeasure>
    )
}
