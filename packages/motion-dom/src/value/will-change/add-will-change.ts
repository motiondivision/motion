import { MotionGlobalConfig } from "motion-utils"
import type { VisualElement } from "../../render/VisualElement"
import { isWillChangeMotionValue } from "./is"

export function addValueToWillChange(
    visualElement: VisualElement,
    key: string
) {
    const willChange = visualElement.getValue("willChange")

    /**
     * It could be that a user has set willChange to a regular MotionValue,
     * in which case we can't add the value to it.
     */
    if (isWillChangeMotionValue(willChange)) {
        return willChange.add(key)
    } else if (!willChange && MotionGlobalConfig.WillChange) {
        const newWillChange = new MotionGlobalConfig.WillChange("auto")

        visualElement.addValue("willChange", newWillChange)
        newWillChange.add(key)
    }
}
