import {
    createBox,
    MotionNodeOptions,
    ResolvedValues,
    scrapeHTMLMotionValuesFromProps,
    transformProps,
    ValueAnimationOptions,
    VisualElement,
} from "motion-dom"
import { NativeValueAnimation } from "./NativeValueAnimation"
import type { NativeHost } from "./types"

export interface NativeRenderState {}

/**
 * Renders a React Native view through a NativeHost. Values Motion animates
 * on its own are played on the UI thread, the rest are written from JS.
 */
export class NativeVisualElement extends VisualElement<
    NativeHost,
    NativeRenderState
> {
    type = "native"

    /**
     * React Native can't read a view's style, so an animation without an
     * origin in `initial` or `style` starts from the property's default.
     */
    readValueFromInstance(_: NativeHost, key: string) {
        return transformProps.has(key)
            ? key.startsWith("scale")
                ? 1
                : 0
            : key === "opacity"
            ? 1
            : undefined
    }

    getBaseTargetFromProps(props: MotionNodeOptions, key: string) {
        return (props as any).style?.[key]
    }

    scrapeMotionValuesFromProps(
        props: MotionNodeOptions,
        prevProps: MotionNodeOptions,
        visualElement: VisualElement
    ) {
        return scrapeHTMLMotionValuesFromProps(props, prevProps, visualElement)
    }

    removeValueFromRenderState() {}

    measureInstanceViewportBox() {
        return createBox()
    }

    sortInstanceNodePosition() {
        return 0
    }

    build() {}

    renderInstance(host: NativeHost) {
        host.write(this.latestValues as ResolvedValues)
    }

    /**
     * Play the animation on the UI thread unless JS needs its value every
     * frame: for `onUpdate`, or a motion value passed in by the user, which
     * might be read by other values.
     */
    createAnimation = (options: ValueAnimationOptions<any>) => {
        const { motionValue, hasOnUpdate } = options

        if (
            this.current &&
            motionValue?.owner === this &&
            !hasOnUpdate &&
            !this.props.onUpdate
        ) {
            return NativeValueAnimation.create(options, this.current)
        }
    }
}
