import { propEffect } from "../../effects/prop"
import { createBox } from "../../projection/geometry/models"
import { VisualElement } from "../VisualElement"

export class ObjectVisualElement extends VisualElement<Object> {
    type = "object"

    effect = propEffect

    readValueFromInstance(instance: Object, key: string) {
        return propEffect.read(instance, key)
    }

    getBaseTargetFromProps() {
        return undefined
    }

    measureInstanceViewportBox() {
        return createBox()
    }

    sortInstanceNodePosition() {
        return 0
    }
}
