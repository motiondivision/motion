"use client"

import {
    frame,
    microtask,
    globalProjectionState,
    type IProjectionNode,
    type VisualElement,
} from "motion-dom"
import { Component, useContext } from "react"
import { usePresence } from "../../../components/AnimatePresence/use-presence"
import {
    LayoutGroupContext,
    LayoutGroupContextProps,
} from "../../../context/LayoutGroupContext"
import { SwitchLayoutGroupContext } from "../../../context/SwitchLayoutGroupContext"
import { MotionProps } from "../../types"

interface MeasureContextProps {
    layoutGroup: LayoutGroupContextProps
    switchLayoutGroup?: SwitchLayoutGroupContext
    isPresent: boolean
    safeToRemove?: VoidFunction | null
}

type MeasureProps = MotionProps &
    MeasureContextProps & { visualElement: VisualElement }

/**
 * Track whether we've taken any snapshots yet. If not,
 * we can safely skip notification of didUpdate.
 *
 * Difficult to capture in a test but to prevent flickering
 * we must set this to true either on update or unmount.
 * Running `next-env/layout-id` in Safari will show this behaviour if broken.
 */
let hasTakenAnySnapshot = false

/**
 * The projection node is created with the props from the component's first
 * render, so keep these in sync as they can change (or be enabled) later.
 */
const layoutOptions = ({
    layout,
    layoutDependency,
    layoutAnchor,
}: MeasureProps) => ({
    layout,
    layoutDependency,
    layoutAnchor,
    animationType: typeof layout === "string" ? layout : "both",
})

/**
 * Move a mounted node to its new layoutId's stack, as an unmount and remount
 * would. Returns a takeover to run once every node in the commit has had the
 * chance to change its layoutId.
 */
const switchLayoutId = (projection: IProjectionNode, layoutId?: string) => {
    const { snapshot } = projection
    const stack = projection.getStack()
    const wasLead = projection.isLead()
    stack?.remove(projection)
    /**
     * If this node led the old stack, the new lead animates from this
     * node's snapshot, which it now holds. Unlike a node that unmounts, this
     * one stays mounted, so unlink them: the new lead mustn't read this
     * node's snapshot after it changes, or stop or share its animation.
     */
    const lead = stack?.lead
    if (wasLead && lead?.resumeFrom === projection)
        lead.resumeFrom = lead.currentAnimation = projection.resumingFrom =
            undefined
    projection.options.layoutId = layoutId

    if (!layoutId) return
    projection.root!.registerSharedNode(layoutId, projection)

    /**
     * Like a mounting node, this one animates from the lead it replaces.
     * But if that lead is still on screen with this layoutId (e.g. an open
     * card moving to another thumbnail), this node is already on screen
     * too, so it takes over instantly: it keeps its own snapshot, and the
     * lead is hidden, as at the end of a crossfade. A lead that left the
     * stack in this commit (e.g. layoutId={selected ? "x" : undefined})
     * is animated from.
     */
    return () => {
        const { resumeFrom } = projection
        if (resumeFrom && projection.getStack()!.members.includes(resumeFrom)) {
            resumeFrom.hide()
            projection.resumeFrom = undefined
            projection.snapshot = snapshot
        }
    }
}

class MeasureLayoutWithContext extends Component<MeasureProps> {
    takeOver?: VoidFunction

    /**
     * This only mounts projection nodes for components that
     * need measuring, we might want to do it for all components
     * in order to incorporate transforms
     */
    componentDidMount() {
        const { visualElement, layoutGroup, switchLayoutGroup, layoutId } =
            this.props
        const { projection } = visualElement

        if (projection) {
            layoutGroup.group?.add(projection)
            layoutId && switchLayoutGroup?.register?.(projection)

            if (hasTakenAnySnapshot) {
                projection.root!.didUpdate()
            }

            /**
             * Without `layout` or `drag`, this only renders while there's a
             * layoutId, so a mounted node can gain one here.
             */
            if (projection.options.layoutId !== layoutId)
                switchLayoutId(projection, layoutId)?.()

            projection.addEventListener("animationComplete", () =>
                this.safeToRemove()
            )
            projection.setOptions({
                ...projection.options,
                ...layoutOptions(this.props),
                onExitComplete: () => this.safeToRemove(),
            })
        }

        globalProjectionState.hasEverUpdated = true
    }

    getSnapshotBeforeUpdate(prevProps: MeasureProps) {
        const { layoutDependency, layoutId, visualElement, drag, isPresent } =
            this.props
        const { projection } = visualElement

        if (!projection) return null

        /**
         * TODO: We use this data in relegate to determine whether to
         * promote a previous element. There's no guarantee its presence data
         * will have updated by this point - if a bug like this arises it will
         * have to be that we markForRelegation and then find a new lead some other way,
         * perhaps in didUpdate
         */
        projection.isPresent = isPresent

        if (prevProps.layoutId !== layoutId) {
            projection.willUpdate()
            this.takeOver = switchLayoutId(projection, layoutId)
        }

        projection.setOptions({
            ...projection.options,
            ...layoutOptions(this.props),
        })

        hasTakenAnySnapshot = true

        if (
            drag ||
            prevProps.layoutDependency !== layoutDependency ||
            layoutDependency === undefined ||
            prevProps.isPresent !== isPresent
        ) {
            projection.willUpdate()
        } else {
            this.safeToRemove()
        }

        if (prevProps.isPresent !== isPresent) {
            if (isPresent) {
                projection.promote()
            } else if (!projection.relegate()) {
                /**
                 * If there's another stack member taking over from this one,
                 * it's in charge of the exit animation and therefore should
                 * be in charge of the safe to remove. Otherwise we call it here.
                 */
                frame.postRender(() => {
                    projection.getStack()?.members.length || this.safeToRemove()
                })
            }
        }

        return null
    }

    componentDidUpdate() {
        const { projection } = this.props.visualElement
        if (projection) {
            this.takeOver?.()
            this.takeOver = undefined
            projection.root!.didUpdate()

            microtask.postRender(() => {
                if (!projection.currentAnimation && projection.isLead()) {
                    this.safeToRemove()
                }
            })
        }
    }

    componentWillUnmount() {
        const {
            visualElement,
            layoutGroup,
            switchLayoutGroup: promoteContext,
        } = this.props
        const { projection } = visualElement

        hasTakenAnySnapshot = true

        if (projection) {
            projection.scheduleCheckAfterUnmount()
            layoutGroup.group?.remove(projection)
            promoteContext?.deregister?.(projection)
        }
    }

    safeToRemove() {
        this.props.safeToRemove?.()
    }

    render() {
        return null
    }
}

export function MeasureLayout(
    props: MotionProps & { visualElement: VisualElement }
) {
    const [isPresent, safeToRemove] = usePresence()
    const layoutGroup = useContext(LayoutGroupContext)

    return (
        <MeasureLayoutWithContext
            {...props}
            layoutGroup={layoutGroup}
            switchLayoutGroup={useContext(SwitchLayoutGroupContext)}
            isPresent={isPresent}
            safeToRemove={safeToRemove}
        />
    )
}
