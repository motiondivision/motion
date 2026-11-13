import { createBox } from "../../projection/geometry/models"
import type { MotionNode } from "../../node/MotionNode"
import type { MotionValue } from "../../value"
import type { VisualElementOptions } from "../types"
import { VisualElement } from "../VisualElement"

function isObjectKey(key: string, object: Object): key is keyof Object {
    return key in object
}

export class ObjectVisualElement extends VisualElement<Object> {
    type = "object"

    /**
     * Declared rather than implicit, as the implicit constructor compiles
     * to super(...arguments), which is slow to run per element.
     */
    constructor(
        options: VisualElementOptions<Object>,
        renderOptions?: {}
    ) {
        super(options, renderOptions)
    }

    readValueFromInstance(instance: Object, key: string) {
        if (isObjectKey(key, instance)) {
            const value = instance[key]
            if (typeof value === "string" || typeof value === "number") {
                return value
            }
        }

        return undefined
    }

    getBaseTargetFromProps() {
        return undefined
    }

    measureInstanceViewportBox() {
        return createBox()
    }

    bind = (
        instance: any,
        node: MotionNode,
        key: string,
        value?: MotionValue
    ) =>
        node.set(key, value, () => {
            instance[key] = node.latestValues[key]
        })

    sortInstanceNodePosition() {
        return 0
    }
}
