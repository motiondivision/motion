"use client"

import { isHTMLElement } from "motion-dom"
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
}

interface Props {
    children: React.ReactElement
    isPresent: boolean
    anchorX?: "left" | "right"
    root?: HTMLElement | ShadowRoot
}

interface MeasureProps extends Props {
    childRef: React.RefObject<HTMLElement | null>
    sizeRef: React.RefObject<Size>
}

/**
 * Measurement functionality has to be within a separate component
 * to leverage snapshot lifecycle.
 */
class PopChildMeasure extends React.Component<MeasureProps> {
    getSnapshotBeforeUpdate(prevProps: MeasureProps) {
        const element = this.props.childRef.current
        if (element && prevProps.isPresent && !this.props.isPresent) {
            const parent = element.offsetParent
            const parentWidth = isHTMLElement(parent)
                ? parent.offsetWidth || 0
                : 0

            const size = this.props.sizeRef.current!
            size.height = element.offsetHeight || 0
            size.width = element.offsetWidth || 0
            size.top = element.offsetTop
            size.left = element.offsetLeft
            size.right = parentWidth - size.width - size.left
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

export function PopChild({ children, isPresent, anchorX, root }: Props) {
    const id = useId()
    const ref = useRef<HTMLElement>(null)
    const size = useRef<Size>({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
    })
    const { nonce } = useContext(MotionConfigContext)
    const composedRef = useComposedRefs(
        ref,
        (children as { ref?: React.Ref<HTMLElement> })?.ref
    )

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
        const { width, height, top, left, right } = size.current
        if (isPresent || !ref.current || !width || !height) return

        const x = anchorX === "left" ? `left: ${left}` : `right: ${right}`

        ref.current.dataset.motionPopId = id

        const style = document.createElement("style")
        if (nonce) style.nonce = nonce

        const parent = root ?? document.head
        parent.appendChild(style)

        if (style.sheet) {
            style.sheet.insertRule(`
          [data-motion-pop-id="${id}"] {
            position: absolute !important;
            width: ${width}px !important;
            height: ${height}px !important;
            ${x}px !important;
            top: ${top}px !important;
          }
        `)
        }

        return () => {
            if (parent.contains(style)) {
                parent.removeChild(style)
            }
        }
    }, [isPresent])

    return (
        <PopChildMeasure isPresent={isPresent} childRef={ref} sizeRef={size}>
            {React.cloneElement(children as any, { ref: composedRef })}
        </PopChildMeasure>
    )
}
