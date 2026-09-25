import { isMotionValue } from "../../value/utils/is-motion-value"
import type { MotionValue } from "../../value"
import type { AnyResolvedKeyframe } from "../../animation/types"
import { DOMKeyframesResolver } from "../../animation/keyframes/DOMKeyframesResolver"
import type { MotionNodeOptions } from "../../node/types"
import type { DOMVisualElementOptions } from "./types"
import type { HTMLRenderState } from "../html/types"
import type { SVGRenderState } from "../svg/types"
import type { ResolvedValues } from "../types"
import { VisualElement, MotionStyle } from "../VisualElement"

const clearRemoved = (
    prev: ResolvedValues,
    next: ResolvedValues,
    removed: "" | null
) => {
    for (const key in prev) {
        if (!(key in next)) next[key] = removed as string
    }
}

export abstract class DOMVisualElement<
    Instance extends HTMLElement | SVGElement = HTMLElement,
    State extends HTMLRenderState = HTMLRenderState,
    Options extends DOMVisualElementOptions = DOMVisualElementOptions
> extends VisualElement<Instance, State, Options> {
    sortInstanceNodePosition(a: Instance, b: Instance): number {
        /**
         * compareDocumentPosition returns a bitmask, by using the bitwise &
         * we're returning true if 2 in that bitmask is set to true. 2 is set
         * to true if b precedes a.
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

    /**
     * While values are suspended, build from an empty render state so
     * nothing from earlier builds lingers, then remove whatever rendered
     * last time but not now: styles and variables by writing "", SVG
     * attributes by writing null.
     */
    triggerBuild() {
        if (!this.suspendedValues?.size) return super.triggerBuild()

        const renderState: HTMLRenderState & Partial<SVGRenderState> =
            this.renderState
        const { style, vars, attrs } = renderState
        renderState.style = {}
        renderState.vars = {}
        renderState.transform = {}
        renderState.transformOrigin = {}

        super.triggerBuild()

        clearRemoved(style, renderState.style, "")
        clearRemoved(vars, renderState.vars, "")
        attrs && clearRemoved(attrs, renderState.attrs!, null)
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
