import { addUniqueItem, removeItem } from "motion-utils"
import { IProjectionNode } from "../node/types"

export class NodeStack {
    lead?: IProjectionNode
    prevLead?: IProjectionNode
    members: IProjectionNode[] = []

    add(node: IProjectionNode) {
        addUniqueItem(this.members, node)
        node.scheduleRender()
    }

    remove(node: IProjectionNode) {
        removeItem(this.members, node)
        if (node === this.prevLead) {
            this.prevLead = undefined
        }
        if (node === this.lead) {
            const prevLead = this.members[this.members.length - 1]
            if (prevLead) {
                this.promote(prevLead)
            }
        }
    }

    relegate(node: IProjectionNode): boolean {
        const indexOfNode = this.members.findIndex((member) => node === member)
        if (indexOfNode === 0) return false

        /**
         * Find the next projection node that is present
         */
        let prevLead: IProjectionNode | undefined
        for (let i = indexOfNode; i >= 0; i--) {
            const member = this.members[i]
            if (member.isPresent !== false) {
                prevLead = member
                break
            }
        }

        if (prevLead) {
            this.promote(prevLead)
            return true
        } else {
            return false
        }
    }

    promote(node: IProjectionNode, preserveFollowOpacity?: boolean) {
        const prevLead = this.lead

        if (node === prevLead) return

        console.log("[projection] promote", {
            layoutId: node.options.layoutId,
            node: node.id,
            prevLead: prevLead?.id,
            prevLeadSnapshot: Boolean(prevLead?.snapshot),
            prevLeadResumeFrom: Boolean(prevLead?.resumeFrom),
        })

        this.prevLead = prevLead
        this.lead = node

        node.show()

        if (prevLead) {
            prevLead.instance && prevLead.scheduleRender()
            node.scheduleRender()

            /**
             * If both the new and previous lead have the same defined layoutDependency,
             * skip the shared layout animation. This allows components with layoutId
             * to opt-out of animations when their layoutDependency hasn't changed,
             * even when the component unmounts and remounts in a different location.
             */
            const prevDep = prevLead.options.layoutDependency
            const nextDep = node.options.layoutDependency
            const dependencyMatches =
                prevDep !== undefined &&
                nextDep !== undefined &&
                prevDep === nextDep

            if (!dependencyMatches) {
                node.resumeFrom = prevLead

                if (preserveFollowOpacity) {
                    node.resumeFrom.preserveOpacity = true
                }

                if (prevLead.snapshot) {
                    node.snapshot = prevLead.snapshot
                    node.snapshot.latestValues =
                        prevLead.animationValues || prevLead.latestValues
                }

                if (node.root && node.root.isUpdating) {
                    node.isLayoutDirty = true
                }
            }

            const { crossfade } = node.options
            if (crossfade === false) {
                prevLead.hide()
            }
        }
    }

    exitAnimationComplete() {
        this.members.forEach((node) => {
            const { options, resumingFrom } = node

            options.onExitComplete && options.onExitComplete()

            if (resumingFrom) {
                resumingFrom.options.onExitComplete &&
                    resumingFrom.options.onExitComplete()
            }
        })
    }

    scheduleRender() {
        this.members.forEach((node) => {
            node.instance && node.scheduleRender(false)
        })
    }

    /**
     * Clear any leads that have been removed this render to prevent them from being
     * used in future animations and to prevent memory leaks
     */
    removeLeadSnapshot() {
        if (this.lead && this.lead.snapshot) {
            this.lead.snapshot = undefined
        }
    }
}
