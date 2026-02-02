import { addUniqueItem, removeItem } from "motion-utils"
import { IProjectionNode } from "../node/types"

/**
 * Manages projection nodes for a single layoutId history.
 * Eager cleanup in add() prevents memory leaks; lazy validation in promote() handles SPA race conditions.
 */
export class NodeStack {
    lead?: IProjectionNode
    prevLead?: IProjectionNode
    members: IProjectionNode[] = []

    add(node: IProjectionNode) {
        this.members = this.members.filter((m) => this.isAlive(m))
        
        if (this.lead && !this.members.includes(this.lead)) {
            this.lead = undefined
        }
        if (this.prevLead && !this.members.includes(this.prevLead)) {
            this.prevLead = undefined
        }

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

        let prevLead: IProjectionNode | undefined
        for (let i = indexOfNode - 1; i >= 0; i--) {
            const member = this.members[i]
            if (this.isAlive(member)) {
                prevLead = member
                break
            }
        }

        if (prevLead) {
            this.promote(prevLead)
            return true
        }
        return false
    }

    promote(node: IProjectionNode, preserveFollowOpacity?: boolean) {
        const prevLead = this.lead
        if (node === prevLead) return

        this.prevLead = this.isAlive(prevLead) ? prevLead : undefined
        this.lead = node
        node.show()

        if (this.prevLead) {
            const prevDep = this.prevLead.options.layoutDependency
            const nextDep = node.options.layoutDependency
            
            if (prevDep === undefined || nextDep === undefined || prevDep !== nextDep) {
                this.setupAnimation(node, this.prevLead, preserveFollowOpacity)
            }
            
            this.prevLead.scheduleRender()
        }
        
        node.scheduleRender()
    }

    private setupAnimation(node: IProjectionNode, prevLead: IProjectionNode, preserveFollowOpacity?: boolean) {
        node.resumeFrom = prevLead

        if (preserveFollowOpacity) {
            node.resumeFrom.preserveOpacity = true
        }

        if (prevLead.snapshot) {
            node.snapshot = prevLead.snapshot
            node.snapshot.latestValues = prevLead.animationValues || prevLead.latestValues
        }

        if (node.root?.isUpdating) {
            node.isLayoutDirty = true
        }

        if (node.options.crossfade === false) {
            prevLead.hide()
        }
    }

    private isAlive(node?: IProjectionNode): node is IProjectionNode {
        if (!node) return false
        if (node.isPresent === false) return true
        if (node.snapshot) return true
        
        const instance = node.instance as { isConnected?: boolean } | undefined
        if (!instance) return true
        
        return instance.isConnected !== false
    }

    exitAnimationComplete() {
        this.members.forEach((node) => {
            const { options, resumingFrom } = node
            options.onExitComplete && options.onExitComplete()
            if (resumingFrom) {
                resumingFrom.options.onExitComplete && resumingFrom.options.onExitComplete()
            }
        })
    }

    scheduleRender() {
        this.members.forEach((node) => {
            node.instance && node.scheduleRender(false)
        })
    }

    removeLeadSnapshot() {
        if (this.lead && this.lead.snapshot) {
            this.lead.snapshot = undefined
        }
    }
}
