import { acceleratedValues, transformProps } from "motion-dom"
import { camelToDash } from "../../render/dom/utils/camel-to-dash"

export function getWillChangeName(name: string): string | undefined {
    if (transformProps.has(name)) {
        return "transform"
    } else if (acceleratedValues.has(name)) {
        return camelToDash(name)
    }
}
