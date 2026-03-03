import { addUniqueItem, removeItem } from "motion-utils"
import type { IProjectionNode } from "../node/types"

export class NodeStack {
    lead?: IProjectionNode
    prevLead?: IProjectionNode
    members: IProjectionNode[] = []

    add(node: IProjectionNode) {
        addUniqueItem(this.members, node)

        for (let i = this.members.length - 1; i >= 0; i--) {
            const member = this.members[i]
            if (member === node || member === this.lead || member === this.prevLead) continue
            const inst = member.instance as HTMLElement | undefined
            if ((!inst || inst.isConnected === false) && !member.snapshot) {
                removeItem(this.members, member)
                member.unmount()
            }
        }

        node.scheduleRender()
    }

    remove(node: IProjectionNode) {
        removeItem(this.members, node)
        if (node === this.prevLead) this.prevLead = undefined
        if (node === this.lead) {
            const prevLead = this.members[this.members.length - 1]
            if (prevLead) this.promote(prevLead)
        }
    }

    relegate(node: IProjectionNode) {
        for (let i = this.members.indexOf(node) - 1; i >= 0; i--) {
            const member = this.members[i]
            if (member.isPresent !== false && (member.instance as HTMLElement)?.isConnected !== false) {
                this.promote(member)
                return true
            }
        }
        return false
    }

    promote(node: IProjectionNode, preserveFollowOpacity?: boolean) {
        const prevLead = this.lead
        if (node === prevLead) return

        this.prevLead = prevLead
        this.lead = node
        node.show()

        if (prevLead) {
            prevLead.updateSnapshot()
            node.scheduleRender()

            const { layoutDependency: prevDep } = prevLead.options
            const { layoutDependency: nextDep } = node.options

            if (prevDep === undefined || prevDep !== nextDep) {
                node.resumeFrom = prevLead
                if (preserveFollowOpacity) prevLead.preserveOpacity = true

                if (prevLead.snapshot) {
                    node.snapshot = prevLead.snapshot
                    node.snapshot.latestValues =
                        prevLead.animationValues || prevLead.latestValues
                }

                if (node.root?.isUpdating) node.isLayoutDirty = true
            }
            if (node.options.crossfade === false) prevLead.hide()
        }
    }

    exitAnimationComplete() {
        this.members.forEach((member) => {
            member.options.onExitComplete?.()
            member.resumingFrom?.options.onExitComplete?.()
        })
    }

    scheduleRender() {
        this.members.forEach(
            (member) => member.instance && member.scheduleRender(false)
        )
    }

    removeLeadSnapshot() {
        if (this.lead?.snapshot) this.lead.snapshot = undefined
    }
}
