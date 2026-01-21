import { warnOnce } from "motion-utils"
import { createMotionComponent, MotionComponentOptions } from "../../motion"
import { FeaturePackages } from "../../motion/features/types"
import { MotionProps } from "../../motion/types"
import { DOMMotionComponents } from "../dom/types"
import { CreateVisualElement } from "../types"

/**
 * I'd rather the return type of `custom` to be implicit but this throws
 * incorrect relative paths in the exported types and API Extractor throws
 * a wobbly.
 */
type ComponentProps<Props> = React.PropsWithoutRef<Props & MotionProps> &
    React.RefAttributes<SVGElement | HTMLElement>
export type CustomDomComponent<Props> = React.ComponentType<
    ComponentProps<Props>
>

type MotionProxy = typeof createMotionComponent &
    DOMMotionComponents & { create: typeof createMotionComponent }

export function createMotionProxy(
    preloadedFeatures?: FeaturePackages,
    createVisualElement?: CreateVisualElement
): MotionProxy {
    if (typeof Proxy === "undefined") {
        return createMotionComponent as MotionProxy
    }

    /**
     * A cache of generated `motion` components, e.g `motion.div`, `motion.input` etc.
     * Rather than generating them anew every render.
     */
    const componentCache = new Map<string, any>()

    const factory = <Props>(
        Component: string | React.ComponentType<Props>,
        options?: MotionComponentOptions
    ) => {
        return createMotionComponent(
            Component,
            options,
            preloadedFeatures,
            createVisualElement
        )
    }

    /**
     * Support for deprecated`motion(Component)` pattern
     */
    const deprecatedFactoryFunction = <Props>(
        Component: string | React.ComponentType<Props>,
        options?: MotionComponentOptions
    ) => {
        if (process.env.NODE_ENV !== "production") {
            warnOnce(
                false,
                "motion() is deprecated. Use motion.create() instead."
            )
        }
        return factory(Component, options)
    }

    return new Proxy(deprecatedFactoryFunction, {
        /**
         * Called when `motion` is referenced with a prop: `motion.div`, `motion.input` etc.
         * The prop name is passed through as `key` and we can use that to generate a `motion`
         * DOM component with that name.
         */
        get: (_target, key: string) => {
            if (key === "create") return factory

            /**
             * If this element doesn't exist in the component cache, create it and cache.
             */
            if (!componentCache.has(key)) {
                componentCache.set(
                    key,
                    createMotionComponent(
                        key,
                        undefined,
                        preloadedFeatures,
                        createVisualElement
                    )
                )
            }

            return componentCache.get(key)!
        },
    }) as MotionProxy
}
