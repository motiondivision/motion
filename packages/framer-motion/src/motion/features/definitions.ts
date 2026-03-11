import { getFeatureDefinitions, setFeatureDefinitions } from "motion-dom"
import { MotionProps } from "../types"
import { FeatureDefinitions } from "./types"

const featureProps = {
    animation: [
        "animate",
        "variants",
        "whileHover",
        "whileTap",
        "exit",
        "whileInView",
        "whileFocus",
        "whileDrag",
    ],
    exit: ["exit"],
    drag: ["drag", "dragControls"],
    focus: ["whileFocus"],
    hover: ["whileHover", "onHoverStart", "onHoverEnd"],
    tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
    pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
    inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
    layout: ["layout", "layoutId"],
}

let isInitialized = false

/**
 * Initialize feature definitions with isEnabled checks.
 * This must be called before any motion components are rendered.
 */
export function initFeatureDefinitions() {
    if (isInitialized) return

    const initialFeatureDefinitions: Partial<FeatureDefinitions> = {}

    for (const key in featureProps) {
        initialFeatureDefinitions[
            key as keyof typeof initialFeatureDefinitions
        ] = {
            isEnabled: (props: MotionProps) =>
                featureProps[key as keyof typeof featureProps].some(
                    (name: string) => !!props[name as keyof typeof props]
                ),
        }
    }

    setFeatureDefinitions(initialFeatureDefinitions)
    isInitialized = true
}

/**
 * Get the current feature definitions, initializing if needed.
 */
export function getInitializedFeatureDefinitions(): Partial<FeatureDefinitions> {
    initFeatureDefinitions()
    return getFeatureDefinitions()
}
