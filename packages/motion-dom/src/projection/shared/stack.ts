import { addUniqueItem, removeItem } from "motion-utils"
import { IProjectionNode } from "../node/types"

/**
 * Manages temporal history of projection nodes for a single layoutId.
 */
export class NodeStack {
    lead?: IProjectionNode
    prevLead?: IProjectionNode
    members: IProjectionNode[] = []

    /**
     * Add node to stack. Preserves existing leads during filtering to ensure 
     * shared layout transitions can capture snapshots from unmounting components.
     */
    add(node: IProjectionNode) {
        this.members = this.members.filter(m => 
            m === this.lead || m === this.prevLead || this.isAlive(m)
        )
        
        addUniqueItem(this.members, node)
        node.scheduleRender()
    }

    /**
     * Remove node. Promotes last member to lead if current lead is removed.
     */
    remove(node: IProjectionNode) {
        removeItem(this.members, node)
        
        if (node === this.prevLead) this.prevLead = undefined
        if (node === this.lead) {
            const prevLead = this.members[this.members.length - 1]
            if (prevLead) this.promote(prevLead)
        }
    }

    /**
     * Search backwards for nearest valid ancestor and promote it.
     * Used when current lead is being demoted but stack has prior history.
     */
    relegate(node: IProjectionNode): boolean {
        const index = this.members.findIndex(m => node === m)
        if (index <= 0) return false

        for (let i = index - 1; i >= 0; i--) {
            if (this.isAlive(this.members[i])) {
                this.promote(this.members[i])
                return true
            }
        }
        return false
    }

    /**
     * Promote node to lead. Validates previous lead viability lazily to handle 
     * SPA navigations where previous component unmounted before snapshot capture.
     */
    promote(node: IProjectionNode, preserveFollowOpacity?: boolean) {
        const prevLead = this.lead
        if (node === prevLead) return

        this.prevLead = prevLead
        this.lead = node
        node.show()

        if (this.prevLead && this.isAlive(this.prevLead)) {
            this.prevLead.scheduleRender()
            
            const prevDep = this.prevLead.options.layoutDependency
            const nextDep = node.options.layoutDependency
            
            if (prevDep !== undefined && nextDep !== undefined && prevDep === nextDep) {
                // Dependencies match: skip shared animation, just render
                node.scheduleRender()
                return
            }

            // Setup shared layout transition
            if (this.prevLead.snapshot) {
                node.snapshot = this.prevLead.snapshot
                node.snapshot.latestValues = this.prevLead.animationValues || this.prevLead.latestValues
            }
            
            node.resumeFrom = this.prevLead
            if (preserveFollowOpacity) node.resumeFrom.preserveOpacity = true
            if (node.root?.isUpdating) node.isLayoutDirty = true
            
            if (node.options.crossfade === false) this.prevLead.hide()
        }
        
        node.scheduleRender()
    }

    /**
     * Notify all members that exit animation completed.
     */
    exitAnimationComplete() {
        this.members.forEach((node) => {
            const { options, resumingFrom } = node
            options.onExitComplete && options.onExitComplete()
            if (resumingFrom) {
                resumingFrom.options.onExitComplete && resumingFrom.options.onExitComplete()
            }
        })
    }

    /**
     * Schedule render for all members with DOM instances.
     */
    scheduleRender() {
        this.members.forEach((node) => {
            node.instance && node.scheduleRender(false)
        })
    }

    /**
     * Clear snapshot from current lead to prevent memory leaks.
     */
    removeLeadSnapshot() {
        if (this.lead?.snapshot) this.lead.snapshot = undefined
    }

    /**
     * Determine if node is valid for animation/retention.
     * Alive if: exiting (isPresent=false), has snapshot (mid-animation), or connected to DOM.
     */
    private isAlive(node?: IProjectionNode): node is IProjectionNode {
        if (!node) return false
        if (node.isPresent === false) return true
        if (node.snapshot) return true
        
        const instance = node.instance as { isConnected?: boolean } | undefined
        if (!instance) return true
        
        return instance.isConnected !== false
    }
}
