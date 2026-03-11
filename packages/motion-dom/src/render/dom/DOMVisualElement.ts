import { isMotionValue } from "../../value/utils/is-motion-value"
import type { MotionValue } from "../../value"
import type { AnyResolvedKeyframe } from "../../animation/types"
import { DOMKeyframesResolver } from "../../animation/keyframes/DOMKeyframesResolver"
import type { MotionNodeOptions } from "../../node/types"
import type { DOMVisualElementOptions } from "./types"
import type { HTMLRenderState } from "../html/types"
import { VisualElement, MotionStyle } from "../VisualElement"

export abstract class DOMVisualElement<
    Instance extends HTMLElement | SVGElement = HTMLElement,
    State extends HTMLRenderState = HTMLRenderState,
    Options extends DOMVisualElementOptions = DOMVisualElementOptions
> extends VisualElement<Instance, State, Options> {
    sortInstanceNodePosition(a: Instance, b: Instance): number {
        /**
         * compareDocumentPosition returns a bitmask, by using the bitwise &
         * we're returning true if 2 in that bitmask is set to true. 2 is set
         * to true if b preceeds a.
         */
        return a.compareDocumentPosition(b) & 2 ? 1 : -1
    }

    getBaseTargetFromProps(
        props: MotionNodeOptions,
        key: string
    ): AnyResolvedKeyframe | MotionValue<any> | undefined {
        const style = (props as MotionNodeOptions & { style?: MotionStyle }).style
        return style ? (style[key] as string) : undefined
    }

    removeValueFromRenderState(
        key: string,
        { vars, style }: HTMLRenderState
    ): void {
        delete vars[key]
        delete style[key]
    }

    KeyframeResolver = DOMKeyframesResolver

    childSubscription?: VoidFunction
    handleChildMotionValue() {
        if (this.childSubscription) {
            this.childSubscription()
            delete this.childSubscription
        }

        const { children } = this.props as MotionNodeOptions & { children?: MotionValue | any }
        if (isMotionValue(children)) {
            this.childSubscription = children.on("change", (latest) => {
                if (this.current) {
                    this.current.textContent = `${latest}`
                }
            })
        }
    }
}
