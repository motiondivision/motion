import { Feature } from "../Feature"

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
