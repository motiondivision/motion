import { MotionValueState } from "../../effects/MotionValueState"
import { createBox } from "../../projection/geometry/models"
import { MotionValue } from "../../value"
import { ResolvedValues } from "../types"
import { VisualElement } from "../VisualElement"

interface ObjectRenderState {
    output: ResolvedValues
}

function isObjectKey(key: string, object: Object): key is keyof Object {
    return key in object
}

export class ObjectVisualElement extends VisualElement<
    Object,
    ObjectRenderState
> {
    type = "object"

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

    bindValueToState(
        instance: Object,
        state: MotionValueState,
        key: string,
        value: MotionValue
    ): VoidFunction {
        return state.set(key, value, () => {
            ;(instance as any)[key] = state.latest[key]
        })
    }

    renderValues(instance: Object, state: MotionValueState) {
        Object.assign(instance, state.latest)
    }

    sortInstanceNodePosition() {
        return 0
    }
}
