import { Feature } from "motion-dom"

let id = 0

export class ExitAnimationFeature extends Feature<unknown> {
    private id: number = id++

    update() {
        if (!this.node.presenceContext) return

        const { isPresent, onExitComplete } = this.node.presenceContext
        const { isPresent: prevIsPresent } = this.node.prevPresenceContext || {}

        if (!this.node.animationState || isPresent === prevIsPresent) {
            return
        }

        /**
         * When a child re-enters (isPresent goes from false back to true),
         * e.g. during rapid carousel navigation where the same key reappears,
         * we need to replay the enter animation from the correct initial
         * position rather than just reversing the exit.
         */
        if (isPresent && prevIsPresent === false) {
            this.replayEnter()
            return
        }

        const exitAnimation = this.node.animationState.setActive(
            "exit",
            !isPresent
        )

        if (onExitComplete && !isPresent) {
            exitAnimation.then(() => {
                onExitComplete(this.id)
            })
        }
    }

    private replayEnter() {
        const props = this.node.getProps()
        const { initial, custom, variants } = props

        if (typeof initial === "string" && variants) {
            const variant = variants[initial]
            if (variant) {
                const resolved =
                    typeof variant === "function"
                        ? variant(custom, {}, {})
                        : variant
                if (typeof resolved === "object") {
                    for (const key in resolved) {
                        if (key === "transition" || key === "transitionEnd")
                            continue
                        this.node
                            .getValue(key)
                            ?.jump(
                                (resolved as Record<string, any>)[key]
                            )
                    }
                }
            }
        }

        this.node.animationState!.reset()
        this.node.animationState!.animateChanges()
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
