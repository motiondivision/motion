import { compareByDepth, WithDepth } from "./compare-by-depth"

export class FlatTree {
    private children = new Set<WithDepth>()

    /**
     * The children in depth order, until they change.
     */
    private sorted?: WithDepth[]

    add(child: WithDepth) {
        this.children.add(child)
        this.sorted = undefined
    }

    remove(child: WithDepth) {
        this.children.delete(child) && (this.sorted = undefined)
    }

    forEach(callback: (child: WithDepth) => void) {
        const { children } = this
        const sorted = (this.sorted ||= [...children].sort(compareByDepth))

        /**
         * A child removed by an earlier callback isn't visited. The
         * list is only replaced when children change, so only then is
         * each one looked up.
         */
        for (let i = 0; i < sorted.length; i++) {
            ;(sorted === this.sorted || children.has(sorted[i])) &&
                callback(sorted[i])
        }
    }
}
