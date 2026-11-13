import { IProjectionNode } from "./types"

export interface NodeGroup {
    add: (node: IProjectionNode) => void
    remove: (node: IProjectionNode) => void
    dirty: VoidFunction
}

export function nodeGroup(): NodeGroup {
    const nodes = new Set<IProjectionNode>()
    const subscriptions = new WeakMap<IProjectionNode, () => void>()

    /**
     * `isUnmount`: a member is unmounting, so React is changing the DOM.
     */
    const dirtyAll = (isUnmount?: boolean) =>
        nodes.forEach(
            (node) => !node.isLayoutDirty && node.willUpdate(false, isUnmount)
        )

    return {
        add: (node) => {
            nodes.add(node)
            subscriptions.set(
                node,
                node.addEventListener("willUpdate", dirtyAll)
            )
        },
        remove: (node) => {
            nodes.delete(node)
            const unsubscribe = subscriptions.get(node)
            if (unsubscribe) {
                unsubscribe()
                subscriptions.delete(node)
            }
            dirtyAll(true)
        },
        dirty: dirtyAll,
    }
}
