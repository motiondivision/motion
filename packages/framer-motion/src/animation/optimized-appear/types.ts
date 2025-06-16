import type { Batcher } from "motion-dom"
import { MotionValue } from "motion-dom"
import { optimizedAppearDataAttribute } from "./data-id"

/**
 * Expose only the needed part of the VisualElement interface to
 * ensure React types don't end up in the generic DOM bundle.
 */
export interface WithAppearProps {
    props: {
        [optimizedAppearDataAttribute]?: string
        values?: {
            [key: string]: MotionValue<number> | MotionValue<string>
        }
    }
}

export type HandoffFunction = (
    storeId: string,
    valueName: string,
    frame: Batcher
) => number | null

/**
 * The window global object acts as a bridge between our inline script
 * triggering the optimized appear animations, and Motion.
 */
declare global {
    interface Window {
        MotionHandoffAnimation?: HandoffFunction
        MotionHandoffMarkAsComplete?: (elementId: string) => void
        MotionHandoffIsComplete?: (elementId: string) => boolean
        MotionHasOptimisedAnimation?: (
            elementId?: string,
            valueName?: string
        ) => boolean
        MotionCancelOptimisedAnimation?: (
            elementId?: string,
            valueName?: string,
            frame?: Batcher,
            canResume?: boolean
        ) => void
        MotionCheckAppearSync?: (
            visualElement: WithAppearProps,
            valueName: string,
            value: MotionValue
        ) => VoidFunction | void
        MotionIsMounted?: boolean
    }
}
