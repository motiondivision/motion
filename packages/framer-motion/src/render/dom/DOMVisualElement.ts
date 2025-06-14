import { DOMKeyframesResolver, MotionValue } from "motion-dom"
import { MotionProps, MotionStyle } from "../../motion/types"
import { DOMVisualElementOptions } from "../dom/types"
import { HTMLRenderState } from "../html/types"
import { VisualElement } from "../VisualElement"

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

}
