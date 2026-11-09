import {
    buildHTMLStyles,
    HTMLVisualElement,
    transformProps,
    type AnyResolvedKeyframe,
    type HTMLRenderState,
    type MotionValue,
    type Owner,
    type ResolvedValues,
} from "framer-motion/dom"
import { defaultPose, isPoseKey } from "./pose"

/**
 * Renders a drawable element inside a canvas layer. It's registered as the
 * element's VisualElement, which is how `animate()`, `drag()` and
 * `animateLayout()` find the renderer that owns an element, so they all
 * animate the layer's values instead of the element's style.
 *
 * Values the layer draws (transforms, opacity and shader uniforms) are
 * left out of the element's style: CSS transforms aren't drawn, and the
 * element's own opacity would apply twice. Anything else, like a colour
 * or CSS variable, is still written to the element, and the browser
 * repaints the canvas when the element changes.
 */
export class CanvasVisualElement extends HTMLVisualElement {
    /**
     * Owns the values this element renders. It has no DOM element, so
     * Motion never runs them on WAAPI or composes them into the element's
     * CSS transform: they stay on the main thread, where the layer reads
     * them each frame.
     */
    private valueOwner: Owner = {
        current: undefined,
        getProps: () => this.props,
    }

    constructor(
        /**
         * Requests a new canvas frame when values change.
         */
        onUpdate: VoidFunction,
        /**
         * Whether the layer draws `key` as a shader uniform.
         */
        private isUniform: (key: string) => boolean,
        private readUniform: (key: string) => AnyResolvedKeyframe | undefined
    ) {
        super({
            props: { onUpdate },
            presenceContext: null,
            visualState: {
                latestValues: {},
                renderState: {
                    transform: {},
                    transformOrigin: {},
                    style: {},
                    vars: {},
                },
            },
        })
    }

    addValue(key: string, value: MotionValue) {
        if (!value.owner || value.owner === this) value.owner = this.valueOwner
        super.addValue(key, value)
    }

    isDrawn(key: string) {
        return (
            isPoseKey(key) ||
            transformProps.has(key) ||
            key.startsWith("origin") ||
            this.isUniform(key)
        )
    }

    readValueFromInstance(instance: HTMLElement, key: string) {
        return isPoseKey(key)
            ? defaultPose[key]
            : this.isUniform(key)
            ? this.readUniform(key)
            : super.readValueFromInstance(instance, key)
    }

    build(renderState: HTMLRenderState, latestValues: ResolvedValues) {
        const styles: ResolvedValues = {}
        for (const key in latestValues) {
            if (!this.isDrawn(key)) styles[key] = latestValues[key]
        }
        buildHTMLStyles(renderState, styles)
    }
}
