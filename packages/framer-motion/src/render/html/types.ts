import { type TransformOrigin, type HTMLRenderState } from "motion-dom"
import { PropsWithoutRef, RefAttributes, JSX } from "react"
import { MotionProps } from "../../motion/types"
import { HTMLElements } from "./supported-elements"

export type { TransformOrigin, HTMLRenderState }

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
