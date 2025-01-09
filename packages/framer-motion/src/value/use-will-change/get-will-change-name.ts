import { acceleratedValues } from "../../animation/animators/utils/accelerated-values"
import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { transformProps } from "../../render/html/utils/keys-transform"

export function getWillChangeName(name: string): string | undefined {
    if (transformProps.has(name)) {
        return "transform"
    } else if (acceleratedValues.has(name)) {
        return camelToDash(name)
    }
}
