import { warnOnce } from "motion-utils"
import { MotionProps } from "../../motion/types"
import { DOMMotionComponents } from "../dom/types"
import type { createMotionComponent } from "./motion/create"

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

export function createDOMMotionComponentProxy(
    componentFactory: typeof createMotionComponent
) {
    type MotionProxy = typeof componentFactory &
        DOMMotionComponents & { create: typeof componentFactory }

    if (typeof Proxy === "undefined") {
        return componentFactory as MotionProxy
    }

    /**
     * A cache of generated `motion` components, e.g `motion.div`, `motion.input` etc.
     * Rather than generating them anew every render.
     */
    const componentCache = new Map<string, any>()

    const deprecatedFactoryFunction: typeof createMotionComponent = (
        ...args
    ) => {
        if (process.env.NODE_ENV !== "production") {
            warnOnce(
                false,
                "motion() is deprecated. Use motion.create() instead."
            )
        }
        return componentFactory(...args)
    }

    return new Proxy(deprecatedFactoryFunction, {
        /**
         * Called when `motion` is referenced with a prop: `motion.div`, `motion.input` etc.
         * The prop name is passed through as `key` and we can use that to generate a `motion`
         * DOM component with that name.
         */
        get: (_target, key: string) => {
            if (key === "create") return componentFactory

            /**
             * If this element doesn't exist in the component cache, create it and cache.
             */
            if (!componentCache.has(key)) {
                componentCache.set(key, componentFactory(key))
            }

            return componentCache.get(key)!
        },
    }) as MotionProxy
}
