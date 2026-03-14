"use client"

import * as React from "react"
import { MutableRefObject, useContext, useMemo, useRef } from "react"
import {
    LayoutGroupContext,
    LayoutGroupContextProps,
} from "../../context/LayoutGroupContext"
import { DeprecatedLayoutGroupContext } from "../../context/DeprecatedLayoutGroupContext"
import { nodeGroup } from "../../projection"
import { useForceUpdate } from "../../utils/use-force-update"

type InheritOption = boolean | "id"

export interface Props {
    id?: string
    inherit?: InheritOption
}

const shouldInheritGroup = (inherit: InheritOption) => inherit === true
const shouldInheritId = (inherit: InheritOption) =>
    shouldInheritGroup(inherit === true) || inherit === "id"

/**
 * `LayoutGroup` provides a context for coordinating layout animations
 * across multiple components. It does **not** animate layout changes on its
 * own — use the `layout` prop on `motion` components for that.
 *
 * Wrap sibling or nested components in a `LayoutGroup` when they need to
 * share or coordinate layout animations (e.g., shared layout transitions,
 * accordions, or tab bars).
 *
 * Also exported as `LayoutProvider` for clarity.
 *
 * ```jsx
 * // Local layout animation (single component)
 * <motion.div layout />
 *
 * // Cross-component coordination
 * <LayoutGroup>
 *   <ComponentA />
 *   <ComponentB />
 * </LayoutGroup>
 * ```
 */
export const LayoutGroup: React.FunctionComponent<
    React.PropsWithChildren<Props>
> = ({ children, id, inherit = true }) => {
    const layoutGroupContext = useContext(LayoutGroupContext)
    const deprecatedLayoutGroupContext = useContext(
        DeprecatedLayoutGroupContext
    )
    const [forceRender, key] = useForceUpdate()
    const context = useRef(
        null
    ) as MutableRefObject<LayoutGroupContextProps | null>

    const upstreamId = layoutGroupContext.id || deprecatedLayoutGroupContext
    if (context.current === null) {
        if (shouldInheritId(inherit) && upstreamId) {
            id = id ? upstreamId + "-" + id : upstreamId
        }

        context.current = {
            id,
            group: shouldInheritGroup(inherit)
                ? layoutGroupContext.group || nodeGroup()
                : nodeGroup(),
        }
    }

    const memoizedContext = useMemo(
        () => ({ ...context.current, forceRender }),
        [key]
    )

    return (
        <LayoutGroupContext.Provider value={memoizedContext}>
            {children}
        </LayoutGroupContext.Provider>
    )
}

/**
 * Alias for `LayoutGroup`. Use whichever name best communicates intent:
 *
 * - `LayoutGroup` — groups components that share layout animations
 * - `LayoutProvider` — provides layout-animation context to descendants
 */
export const LayoutProvider = LayoutGroup
