import { Feature, resolveVariant } from "motion-dom"

let id = 0

export class ExitAnimationFeature extends Feature<unknown> {
    private id: number = id++

    /**
     * The running exit animation, or true once it has completed.
     */
    private exit?: Promise<unknown> | true

    update() {
        const { presenceContext, animationState } = this.node

        if (!presenceContext || !animationState) return

        const { isPresent, onExitComplete } = presenceContext

        /**
         * Compare presence with our own exit, not the previous presence
         * context. An element can mount already exiting, for instance when
         * Suspense reveals it in the render that removed it, and then both
         * contexts have isPresent: false (#4049).
         */
        if (isPresent === !this.exit) return

        if (isPresent) {
            /**
             * When re-entering after the exit completed (element is at
             * rest), replay the enter animation from initial.
             */
            if (this.exit === true) {
                const { initial } = this.node.getProps()

                if (initial && !Array.isArray(initial)) {
                    const { transition, transitionEnd, ...target } =
                        resolveVariant(this.node, initial as any) || {}

                    for (const key in target) {
                        this.node
                            .getValue(key)
                            ?.jump(target[key as keyof typeof target] as any)
                    }
                }

                /**
                 * A re-entering element is no longer an initial child, so
                 * AnimatePresence's initial={false} mustn't block its enter.
                 */
                this.node.blockInitialAnimation = false
                animationState.reset()
                animationState.animateChanges()
            } else {
                animationState.setActive("exit", false)
            }

            this.exit = undefined
            return
        }

        const exit = (this.exit = animationState.setActive("exit", true))

        if (onExitComplete) {
            exit.then(() => {
                /**
                 * An exit can resolve after the element has re-entered, e.g.
                 * when its final tick lands in the stop() of the enter.
                 */
                if (this.exit !== exit) return
                this.exit = true
                onExitComplete(this.id)
            })
        }
    }

    mount() {
        const { register } = this.node.presenceContext || {}

        if (register) {
            this.unmount = register(this.id, this.node)
        }

        // Start the exit of an element that mounts already exiting
        this.update()
    }

    unmount() {}
}
