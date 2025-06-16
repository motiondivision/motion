import { pipe } from "motion-utils"
import { addDomEvent } from "../events/add-dom-event"
import { Feature } from "../motion/features/Feature"

export class FocusGesture extends Feature<Element> {
    private isActive = false

    onFocus() {
        let isFocusVisible = false

        /**
         * If this element doesn't match focus-visible then don't
         * apply whileHover. But, if matches throws that focus-visible
         * is not a valid selector then in that browser outline styles will be applied
         * to the element by default and we want to match that behaviour with whileFocus.
         */
        try {
            isFocusVisible = this.node.current!.matches(":focus-visible")
        } catch (e) {
            isFocusVisible = true
        }

        if (!isFocusVisible || !this.node.animationState) return

        this.node.animationState.setActive("whileFocus", true)
        this.isActive = true
    }

    onBlur() {
        if (!this.isActive || !this.node.animationState) return
        this.node.animationState.setActive("whileFocus", false)
        this.isActive = false
    }

    mount() {
        this.unmount = pipe(
            addDomEvent(this.node.current!, "focus", () => this.onFocus()),
            addDomEvent(this.node.current!, "blur", () => this.onBlur())
        ) as VoidFunction
    }

    unmount() {}
}
