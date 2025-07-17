import { AnyResolvedKeyframe } from "../animation/types"
import { cancelFrame, frame } from "../frameloop/frame"
import { MotionValue } from "../value"
import { numberValueTypes } from "../value/types/maps/number"
import { getValueAsType } from "../value/types/utils/get-as-type"

/**
 * TODO:
 * - Add .mount()
 *      - Make visualElement bind onUpdate with mount and every prop update
 * - Add .unmount(), replace .destroy()
 * - Add .remove(name)
 * - Add ability to set onUpdate
 *      - Cancelframe if this gets unmounted()
 * - Inherit by svg/objet/style/attr
 * - Update effect to use this 
 * - Handle transform template
 * - Add gating for multiple render
 *         const now = time.now()
        if (this.renderScheduledAt < now) {
            this.renderScheduledAt = now
            frame.render(this.render, false, true)
        }
 */

// Rename MotionNodeState
export class MotionNodeState<Subject = any> {
    subject: Subject

    latest: { [name: string]: AnyResolvedKeyframe }

    constructor(initialValues: { [name: string]: AnyResolvedKeyframe } = {}) {
        this.latest = initialValues
    }

    values = new Map<string, { value: MotionValue; onRemove: VoidFunction }>()

    render = () => {
        // Render all bound values
    }

    scheduleRender() {
        frame.render(this.render, false, true)
    }

    has(name: string) {
        return this.values.has(name)
    }

    set(
        name: string,
        value: MotionValue,
        render?: VoidFunction,
        computed?: MotionValue,
        useDefaultValueType = true
    ) {
        const existingValue = this.values.get(name)

        if (existingValue) {
            existingValue.onRemove()
        }

        const onChange = () => {
            const v = value.get()

            if (useDefaultValueType) {
                this.latest[name] = getValueAsType(v, numberValueTypes[name])
            } else {
                this.latest[name] = v
            }

            render && frame.render(render)
        }

        onChange()

        const cancelOnChange = value.on("change", onChange)

        computed && value.addDependent(computed)

        const remove = () => {
            cancelOnChange()
            render && cancelFrame(render)
            this.values.delete(name)
            computed && value.removeDependent(computed)
        }

        this.values.set(name, { value, onRemove: remove })

        return remove
    }

    get(name: string): MotionValue | undefined {
        return this.values.get(name)?.value
    }

    forEachValue(callback: (value: MotionValue, name: string) => void) {
        for (const [name, { value }] of this.values) {
            callback(value, name)
        }
    }

    remove(name: string) {
        const { onRemove } = this.values.get(name) ?? {}
        if (onRemove) {
            onRemove()
            this.values.delete(name)
        }
    }

    mount(subject: Subject) {
        this.subject = subject
    }

    unmount() {
        for (const value of this.values.values()) {
            value.onRemove()
        }
    }
}
