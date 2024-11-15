import { DOMVisualElementOptions } from "../dom/types"
import { VisualElement } from "../VisualElement"
import { MotionProps, MotionStyle } from "../../motion/types"
import { MotionValue } from "../../value"
import { HTMLRenderState } from "../html/types"
import { DOMKeyframesResolver } from "./DOMKeyframesResolver"
import { isMotionValue } from "../../value/utils/is-motion-value"

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
        props: MotionProps,
        key: string
    ): string | number | MotionValue<any> | undefined {
        return props.style
            ? (props.style[key as keyof MotionStyle] as string)
            : undefined
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

        const { children } = this.props
        if (isMotionValue(children)) {
            this.childSubscription = children.on("change", (latest) => {
                if (this.current) {
                    this.current.textContent = `${latest}`;
                }
            })
        }
    }
}
