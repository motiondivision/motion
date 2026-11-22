"use client"

import { globalProjectionState, type VisualElement } from "motion-dom"
import { Component, useContext } from "react"
import {
    LayoutGroupContext,
    LayoutGroupContextProps,
} from "../../../context/LayoutGroupContext"
import { MotionProps } from "../../types"

export interface MeasureBasicContextProps {
    layoutGroup: LayoutGroupContextProps
}

export type MeasureBasicProps = MotionProps &
    MeasureBasicContextProps & { visualElement: VisualElement }

/**
 * Shared snapshot state across basic and full layout measurement components.
 */
export const layoutSnapshotState = { hasTakenAny: false }

export const layoutOptions = ({
    layout,
    layoutDependency,
    layoutAnchor,
}: MotionProps) => ({
    layout,
    layoutDependency,
    layoutAnchor,
    animationType: typeof layout === "string" ? layout : "both",
})

export class MeasureBasicLayoutWithContext<
    P extends MeasureBasicProps = MeasureBasicProps
> extends Component<P> {
    componentDidMount() {
        const { visualElement, layoutGroup } = this.props
        const { projection } = visualElement

        if (projection) {
            layoutGroup.group?.add(projection)

            if (layoutSnapshotState.hasTakenAny) {
                projection.root!.didUpdate()
            }

            projection.setOptions(layoutOptions(this.props))
        }

        globalProjectionState.hasEverUpdated = true
    }

    getSnapshotBeforeUpdate(prevProps: P) {
        const { layoutDependency, visualElement, drag } = this.props
        const { projection } = visualElement

        if (!projection) return null

        projection.setOptions(layoutOptions(this.props))

        layoutSnapshotState.hasTakenAny = true

        if (
            drag ||
            prevProps.layoutDependency !== layoutDependency ||
            layoutDependency === undefined
        ) {
            projection.willUpdate()
        }

        return null
    }

    componentDidUpdate() {
        this.props.visualElement.projection?.root!.didUpdate()
    }

    componentWillUnmount() {
        const { visualElement, layoutGroup } = this.props
        const { projection } = visualElement

        layoutSnapshotState.hasTakenAny = true

        if (projection) {
            projection.scheduleCheckAfterUnmount()
            layoutGroup.group?.remove(projection)
        }
    }

    render() {
        return null
    }
}

export function MeasureBasicLayout(
    props: MotionProps & { visualElement: VisualElement }
) {
    return (
        <MeasureBasicLayoutWithContext
            {...props}
            layoutGroup={useContext(LayoutGroupContext)}
        />
    )
}
