import { DOMKeyframesResolver } from "../../animation/keyframes/DOMKeyframesResolver"
import { addStyleValue, readStyleValue } from "../../effects/style"
import { MotionNode } from "../../node/MotionNode"
import type { MotionValue } from "../../value"
import type { IProjectionNode } from "../../projection/node/types"
import { measureViewportBox } from "../../projection/utils/measure"
import { defaultTransformValue } from "../dom/parse-transform"
import { transformProps } from "../utils/keys-transform"
import {
    hasReducedMotionListener,
    initPrefersReducedMotion,
    prefersReducedMotion,
} from "../utils/reduced-motion"

/**
 * The node of an HTML element that has a projection node but no motion
 * component: one that `animateLayout()` or `drag()` is given. It has
 * the parts of a VisualElement that a projection node and drag controls
 * use, without props, variants or features.
 */
export class HTMLNode extends MotionNode<HTMLElement> {
    projection?: IProjectionNode

    props = {}

    options = {}

    shouldReduceMotion: boolean | null

    bind = addStyleValue

    KeyframeResolver = DOMKeyframesResolver

    constructor(element: HTMLElement) {
        super()
        this.current = element
        hasReducedMotionListener.current || initPrefersReducedMotion()
        this.shouldReduceMotion = prefersReducedMotion.current
    }

    /**
     * An element's computed transform includes its projection
     * transform, so a transform the node has no value for is its default.
     */
    read = (element: HTMLElement, key: string) =>
        this.projection && transformProps.has(key)
            ? defaultTransformValue(key)
            : readStyleValue(element, key)

    measureViewportBox() {
        return measureViewportBox(this.current!)
    }

    setStaticValue(key: string, value: string | number) {
        this.latestValues[key] = value
    }

    /**
     * The element already shows the values it's given, so binding them
     * writes nothing.
     */
    protected bindValue(name: string, value?: MotionValue) {
        this.isSilent = true
        super.bindValue(name, value)
        this.isSilent = false
    }

    /**
     * A projection node sets latest values that have no motion value.
     * They're bound when they're first rendered.
     */
    protected queueAll() {
        for (const key in this.latestValues) {
            this.bindings.has(key) || this.bindValue(key)
        }

        super.queueAll()
    }

    scheduleRender = () => {
        this.step(this.flush, false, true)
        this.queueAll()
    }

    /**
     * Projection styles are written over the values, after any of them
     * is written.
     */
    private writeValues = this.flush

    flush = () => {
        this.writeValues()
        this.projection?.applyProjectionStyles(this.current!.style)
    }

    getTransformPagePoint() {}

    getDefaultTransition() {}

    notify() {}
}
