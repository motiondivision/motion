import { Feature } from "motion-dom"

let id = 0

export class ExitAnimationFeature extends Feature<unknown> {
    private id: number = id++
    private isExitComplete = false

    update() {
        if (!this.node.presenceContext) return

        const { isPresent, onExitComplete } = this.node.presenceContext
        const { isPresent: prevIsPresent } = this.node.prevPresenceContext || {}

        if (!this.node.animationState || isPresent === prevIsPresent) {
            return
        }

        if (isPresent && prevIsPresent === false) {
            /**
             * When re-entering, if the exit animation already completed
             * (element is at rest), reset to initial values so the enter
             * animation replays from the correct position.
             */
            if (this.isExitComplete) {
                const { initial, custom, variants } = this.node.getProps()

                if (typeof initial === "string" && variants?.[initial]) {
                    const variant = variants[initial]
                    const resolved =
                        typeof variant === "function"
                            ? variant(custom, {}, {})
                            : variant

                    if (typeof resolved === "object") {
                        for (const key in resolved) {
                            if (
                                key === "transition" ||
                                key === "transitionEnd"
                            )
                                continue
                            this.node
                                .getValue(key)
                                ?.jump(
                                    (resolved as Record<string, any>)[key]
                                )
                        }
                    }
                }

                this.node.animationState.reset()
                this.node.animationState.animateChanges()
            } else {
                this.node.animationState.setActive("exit", false)
            }

            this.isExitComplete = false
            return
        }

        const exitAnimation = this.node.animationState.setActive(
            "exit",
            !isPresent
        )

        if (onExitComplete && !isPresent) {
            exitAnimation.then(() => {
                this.isExitComplete = true
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
