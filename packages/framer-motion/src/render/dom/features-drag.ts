"use client"

import { createDragMeasureNode, type VisualElement } from "motion-dom"
import { DragGesture } from "../../gestures/drag"
import { drag } from "../../motion/features/drag"
import { FeatureBundle } from "../../motion/features/types"
import type { MotionProps } from "../../motion/types"
import { domAnimation } from "./features-animation"

const DragProjectionNode = {
    create(visualElement: VisualElement<HTMLElement>, props: MotionProps) {
        if (!visualElement.projection && (props.drag || props.dragControls)) {
            createDragMeasureNode(
                visualElement,
                visualElement.current || undefined
            )
        }
    },
}

/**
 * Animations, gestures, pan and drag — without the layout projection
 * system. Use `domMax` when combining `drag` with `layout`, `layoutId`,
 * `layoutScroll`, or `Reorder`.
 *
 * @public
 */
export const domDrag: FeatureBundle = /* @__PURE__ */ Object.assign(
    {},
    domAnimation,
    drag,
    {
        drag: {
            Feature: DragGesture,
            ProjectionNode: DragProjectionNode,
        },
    }
)
