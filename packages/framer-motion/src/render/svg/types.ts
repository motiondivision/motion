import { JSX, SVGAttributes } from "react"
import { MakeMotion, MotionProps } from "../../motion/types"
import { ForwardRefComponent, HTMLRenderState } from "../html/types"
import { ResolvedValues } from "../types"
import { SVGElements } from "./supported-elements"

export interface SVGRenderState extends HTMLRenderState {
    /**
     * Measured dimensions of the SVG element to be used to calculate a transform-origin.
     */
    dimensions?: SVGDimensions

    /**
     * A mutable record of attributes we want to apply directly to the rendered Element
     * every frame. We use a mutable data structure to reduce GC during animations.
     */
    attrs: ResolvedValues

    /**
     * A record of the previous layout values provided by props.
     */
    prevLayoutProps?: {
        x?: number
        y?: number
        width?: number
        height?: number
        cx?: number
        cy?: number
        r?: number
    }
}

export type SVGDimensions = {
    x: number
    y: number
    width: number
    height: number
}

interface SVGAttributesWithoutMotionProps<T>
    extends Pick<
        SVGAttributes<T>,
        Exclude<keyof SVGAttributes<T>, keyof MotionProps>
    > {}

/**
 * Blanket-accept any SVG attribute as a `MotionValue`
 * @public
 */
export type SVGAttributesAsMotionValues<T> = MakeMotion<
    SVGAttributesWithoutMotionProps<T>
>

export type UnwrapSVGFactoryElement<F> = F extends React.SVGProps<infer P>
    ? P
    : never

/**
 * @public
 */
export interface SVGMotionProps<T>
    extends SVGAttributesAsMotionValues<T>,
        MotionProps {}

/**
 * Motion-optimised versions of React's SVG components.
 *
 * @public
 */
export type SVGMotionComponents = {
    [K in SVGElements]: ForwardRefComponent<
        UnwrapSVGFactoryElement<JSX.IntrinsicElements[K]>,
        SVGMotionProps<UnwrapSVGFactoryElement<JSX.IntrinsicElements[K]>>
    >
}
