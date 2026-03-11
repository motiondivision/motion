import {
    AnyResolvedKeyframe,
    MotionValue,
    ResolvedValues,
    type VisualElement,
    type VisualElementEventCallbacks,
    type LayoutLifecycles,
    type UseRenderState,
} from "motion-dom"
import { ReducedMotionConfig } from "../context/MotionConfigContext"
import type { PresenceContextProps } from "../context/PresenceContext"
import { MotionProps } from "../motion/types"
import { VisualState } from "../motion/utils/use-visual-state"
import { DOMMotionComponents } from "./dom/types"

export type { VisualElementEventCallbacks, LayoutLifecycles, UseRenderState }

export type ScrapeMotionValuesFromProps = (
    props: MotionProps,
    prevProps: MotionProps,
    visualElement?: VisualElement
) => {
    [key: string]: MotionValue | AnyResolvedKeyframe
}

export interface VisualElementOptions<Instance, RenderState = any> {
    visualState: VisualState<Instance, RenderState>
    parent?: VisualElement<unknown>
    variantParent?: VisualElement<unknown>
    presenceContext: PresenceContextProps | null
    props: MotionProps
    blockInitialAnimation?: boolean
    reducedMotionConfig?: ReducedMotionConfig
    /**
     * If true, all animations will be skipped and values will be set instantly.
     * Useful for E2E tests and visual regression testing.
     */
    skipAnimations?: boolean
    /**
     * Explicit override for SVG detection. When true, uses SVG rendering;
     * when false, uses HTML rendering. If undefined, auto-detects.
     */
    isSVG?: boolean
}

// Re-export ResolvedValues from motion-dom for backward compatibility
export type { ResolvedValues }

export type CreateVisualElement<
    Props = {},
    TagName extends keyof DOMMotionComponents | string = "div"
> = (
    Component: TagName | string | React.ComponentType<Props>,
    options: VisualElementOptions<HTMLElement | SVGElement>
) => VisualElement<HTMLElement | SVGElement>
