import { Feature, resolveVariant } from "motion-dom"

let id = 0

export class ExitAnimationFeature extends Feature<unknown> {
    private id: number = id++

    /**
     * The running exit animation, or true once it has completed.
     */
    private exit?: Promise<unknown> | true

    update() {
        const { presenceContext, prevPresenceContext, animationState } =
            this.node

        if (!presenceContext || !animationState) return

        const { isPresent, onExitComplete } = presenceContext
        const prevIsPresent = prevPresenceContext?.isPresent

        if (isPresent === prevIsPresent) return

        if (isPresent && prevIsPresent === false) {
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

        const exit = (this.exit = animationState.setActive("exit", !isPresent))

        if (onExitComplete && !isPresent) {
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
        const { register, onExitComplete } = this.node.presenceContext || {}

        if (onExitComplete) {
            onExitComplete(this.id)
        }

        if (register) {
            this.unmount = register(this.id)
        }
    }

    unmount() {}
}
