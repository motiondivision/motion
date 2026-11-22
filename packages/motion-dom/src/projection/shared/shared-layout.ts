import { Axis, Box } from "motion-utils"
import type { Transition } from "../../animation/types"
import type { ResolvedValues } from "../../render/types"
import type { MotionStyle } from "../../render/VisualElement"
import { resolveMotionValue } from "../../value/utils/resolve-motion-value"
import { mixValues } from "../animation/mix-values"
import { calcLength } from "../geometry/delta-calc"
import { createBox } from "../geometry/models"
import { shouldAnimatePositionOnly } from "../geometry/utils"
import type { createBasicProjectionNode } from "../node/create-basic-projection-node"
import type { IProjectionNode, Measurements } from "../node/types"
import { NodeStack } from "./stack"

function hasOpacityCrossfade(node: IProjectionNode) {
    return node.animationValues?.opacityExit !== undefined
}

function alignAxis(output: Axis, from: Axis, layout: Axis) {
    output.max = calcLength(layout) + (output.min = from.min)
}

function resetSharedStyles(
    write: (key: string, value: any) => void,
    styleProp: MotionStyle | undefined,
    opacity: any
) {
    write("visibility", "")
    write("opacity", opacity)
    write(
        "pointerEvents",
        resolveMotionValue(styleProp?.pointerEvents) || ""
    )
}

/**
 * Extend a basic projection node class (created by `createBasicProjectionNode`)
 * with shared-element `layoutId` support (`NodeStack`, `promote`, `relegate`,
 * `mixValues` crossfade, follow-node visibility and pointerEvents).
 */
export function withSharedLayout<I>(
    Base: ReturnType<typeof createBasicProjectionNode<I>>
) {
    return class SharedProjectionNode extends Base {
        stack?: NodeStack
        stackFor?: string

        constructor(latestValues?: ResolvedValues, parent?: IProjectionNode) {
            super(latestValues, parent)
            this.isSharedProjectionDirty = false
            this.isVisible = true
            const { root } = this
            if (!root.sharedNodes) {
                root.sharedNodes = new Map()
                root.stacksChanged = 0
                if (root !== this) {
                    const proto = SharedProjectionNode.prototype
                    Object.assign(root, {
                        registerSharedNode: proto.registerSharedNode,
                        clearAllSnapshots: proto.clearAllSnapshots,
                        resetTree: proto.resetTree,
                    })
                }
            }
        }

        clearAllSnapshots() {
            super.clearAllSnapshots()
            this.sharedNodes.forEach((stack, layoutId) =>
                stack.members.length
                    ? stack.removeLeadSnapshot()
                    : this.sharedNodes.delete(layoutId) && this.stacksChanged++
            )
        }

        mixShared(snapshot: Measurements | undefined) {
            if (snapshot?.source === this.layout?.source) return

            const snapshotLatestValues = snapshot ? snapshot.latestValues : {}
            const mixedValues = { ...this.latestValues }
            const stack = this.getStack()
            const isOnlyMember = !stack || stack.members.length <= 1
            const shouldCrossfadeOpacity =
                !isOnlyMember &&
                this.options.crossfade !== false &&
                !this.path.some(hasOpacityCrossfade)

            return (progress: number) => {
                this.animationValues = mixedValues

                mixValues(
                    mixedValues,
                    snapshotLatestValues,
                    this.latestValues,
                    progress,
                    shouldCrossfadeOpacity,
                    isOnlyMember
                )
            }
        }

        alignTarget(lead: IProjectionNode, target: Box): Box {
            if (
                this.layout &&
                shouldAnimatePositionOnly(
                    this.options.animationType,
                    this.layout.layoutBox,
                    lead.layout!.layoutBox
                )
            ) {
                const { layoutBox } = this.layout
                const aligned = this.target || createBox()
                alignAxis(aligned.x, target.x, layoutBox.x)
                alignAxis(aligned.y, target.y, layoutBox.y)
                return aligned
            }

            return target
        }

        applySharedBefore(
            lead: IProjectionNode,
            targetStyle: any,
            styleProp: MotionStyle | undefined,
            write: (key: string, value: any) => void,
            setLayer: (isLayer?: boolean) => void,
            transformTemplate:
                | ((transform: any, generated: string) => string)
                | undefined
        ) {
            if (!this.isVisible && lead !== this) {
                write("visibility", "hidden")
                return true
            }

            if (this.needsReset) {
                this.needsReset = false
                resetSharedStyles(write, styleProp, "")
                targetStyle.transform = transformTemplate
                    ? transformTemplate(this.latestValues, "")
                    : "none"
                setLayer()
                return true
            }

            return false
        }

        applySharedStyles(
            write: (key: string, value: any) => void,
            styleProp: MotionStyle | undefined,
            lead?: IProjectionNode,
            valuesToRender?: ResolvedValues
        ) {
            if (!lead) {
                if (this.options.layoutId || this.needsShow) {
                    this.needsShow = false
                    resetSharedStyles(
                        write,
                        styleProp,
                        this.latestValues.opacity !== undefined
                            ? this.latestValues.opacity
                            : 1
                    )
                }
                return
            }

            write("visibility", "")

            write(
                "opacity",
                lead.animationValues
                    ? lead === this
                        ? valuesToRender!.opacity ??
                          this.latestValues.opacity ??
                          1
                        : this.preserveOpacity
                        ? this.latestValues.opacity
                        : valuesToRender!.opacityExit
                    : lead === this
                    ? valuesToRender!.opacity !== undefined
                        ? valuesToRender!.opacity
                        : ""
                    : valuesToRender!.opacityExit !== undefined
                    ? valuesToRender!.opacityExit
                    : 0
            )

            if (this.options.layoutId) {
                write(
                    "pointerEvents",
                    lead === this
                        ? resolveMotionValue(styleProp?.pointerEvents) || ""
                        : "none"
                )
            }
        }

        registerSharedNode(layoutId: string, node: IProjectionNode) {
            if (!this.sharedNodes.has(layoutId)) {
                this.sharedNodes.set(layoutId, new NodeStack())
                this.stacksChanged++
            }

            this.sharedNodes.get(layoutId)!.add(node)

            const config = node.options.initialPromotionConfig
            node.promote({
                transition: config?.transition,
                preserveFollowOpacity: config?.shouldPreserveFollowOpacity
                    ? config.shouldPreserveFollowOpacity(node)
                    : undefined,
            })
        }

        isLead(): boolean {
            const stack = this.getStack()
            return stack ? stack.lead === this : true
        }

        getLead(): IProjectionNode {
            return this.getStack()?.lead || this
        }

        getStack(): NodeStack | undefined {
            const { layoutId } = this.options
            if (!layoutId) return
            const { root } = this
            const key = root.stacksChanged + ":" + layoutId
            if (this.stackFor !== key) {
                this.stack = root.sharedNodes.get(layoutId)
                this.stackFor = key
            }
            return this.stack
        }

        promote({
            needsReset,
            transition,
            preserveFollowOpacity,
        }: {
            needsReset?: boolean
            transition?: Transition
            preserveFollowOpacity?: boolean
        } = {}) {
            this.getStack()?.promote(this, preserveFollowOpacity)

            if (needsReset) {
                this.projectionDelta = undefined
                this.needsReset = true
            }
            if (transition) this.setOptions({ transition })
        }

        relegate(): boolean {
            return this.getStack()?.relegate(this) || false
        }

        resetTree() {
            super.resetTree()
            this.root.sharedNodes.clear()
            this.root.stacksChanged++
        }
    }
}
