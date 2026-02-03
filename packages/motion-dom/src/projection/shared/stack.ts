import { addUniqueItem, removeItem } from "motion-utils"
import { IProjectionNode } from "../node/types"

interface DOMInstance {
    isConnected?: boolean
    scheduleRender?: (immediate: boolean) => void
}

export class NodeStack {
    lead?: IProjectionNode
    prevLead?: IProjectionNode
    members: IProjectionNode[] = []

    add(node: IProjectionNode) {
        const valid = this.members.filter((m) => this.isValid(m))

        if (valid.length !== this.members.length) {
            this.members = valid
            if (this.lead && !valid.includes(this.lead)) {
                this.lead = valid[valid.length - 1]
            }
            if (this.prevLead && !valid.includes(this.prevLead)) {
                this.prevLead = undefined
            }
        }

        addUniqueItem(this.members, node)
        node.scheduleRender()
    }

    remove(node: IProjectionNode) {
        removeItem(this.members, node)

        if (node === this.prevLead) this.prevLead = undefined
        if (node === this.lead && this.members.length) {
            this.promote(this.members[this.members.length - 1])
        }
    }

    relegate(node: IProjectionNode): boolean {
        const idx = this.members.indexOf(node)
        if (idx <= 0) return false

        for (let i = idx; i >= 0; i--) {
            if (this.members[i].isPresent !== false) {
                this.promote(this.members[i])
                return true
            }
        }
        return false
    }

    promote(node: IProjectionNode, preserveFollowOpacity?: boolean) {
        const prev = this.lead
        if (node === prev) return

        const canResume = prev && this.isValid(prev)
        this.prevLead = canResume ? prev : undefined
        this.lead = node
        node.show()

        if (prev && canResume) {
            const prevInstance = prev.instance as DOMInstance
            const isConnected = prevInstance?.isConnected !== false

            if (!prev.snapshot && isConnected) {
                prev.updateSnapshot()
            }

            if (isConnected) prev.scheduleRender()
            node.scheduleRender()

            const { layoutDependency: prevDep } = prev.options
            const { layoutDependency: nextDep } = node.options

            if (
                prevDep !== undefined &&
                nextDep !== undefined &&
                prevDep === nextDep
            )
                return

            node.resumeFrom = prev
            if (preserveFollowOpacity) prev.preserveOpacity = true

            if (prev.snapshot) {
                node.snapshot = prev.snapshot
                node.snapshot.latestValues =
                    prev.animationValues || prev.latestValues
            }

            if (node.root?.isUpdating) node.isLayoutDirty = true
            if (node.options.crossfade === false) prev.hide()
        }
    }

    exitAnimationComplete() {
        this.members.forEach((n) => {
            n.options.onExitComplete?.()
            n.resumingFrom?.options.onExitComplete?.()
        })
    }

    scheduleRender() {
        this.members.forEach((n) => {
            const inst = n.instance as DOMInstance
            inst?.scheduleRender?.(false)
        })
    }

    removeLeadSnapshot() {
        this.lead?.snapshot && (this.lead.snapshot = undefined)
    }

    private isValid(n: IProjectionNode): boolean {
        const inst = n.instance as DOMInstance
        const isConnected = inst?.isConnected !== false
        return isConnected || n.isPresent === false || !!n.snapshot
    }
}
