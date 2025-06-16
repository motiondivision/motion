import { ResolvedValues } from "../types"
import { PropsWithoutRef, RefAttributes, JSX } from "react"
import { MotionProps } from "../../motion/types"
import { HTMLElements } from "./supported-elements"

export interface TransformOrigin {
    originX?: number | string
    originY?: number | string
    originZ?: number | string
}

export interface HTMLRenderState {
    /**
     * A mutable record of transforms we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    transform: ResolvedValues

    /**
     * A mutable record of transform origins we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    transformOrigin: TransformOrigin

    /**
     * A mutable record of styles we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    style: ResolvedValues

    /**
     * A mutable record of CSS variables we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    vars: ResolvedValues
}

/**
 * @public
 */
export type ForwardRefComponent<T, P> = { readonly $$typeof: symbol } & ((
    props: PropsWithoutRef<P> & RefAttributes<T>
) => JSX.Element)

type AttributesWithoutMotionProps<Attributes> = {
    [K in Exclude<keyof Attributes, keyof MotionProps>]?: Attributes[K]
}

/**
 * @public
 */
export type HTMLMotionProps<Tag extends keyof HTMLElements> =
    AttributesWithoutMotionProps<JSX.IntrinsicElements[Tag]> & MotionProps

/**
 * Motion-optimised versions of React's HTML components.
 *
 * @public
 */
export type HTMLMotionComponents = {
    [K in keyof HTMLElements]: ForwardRefComponent<
        HTMLElements[K],
        HTMLMotionProps<K>
    >
}
