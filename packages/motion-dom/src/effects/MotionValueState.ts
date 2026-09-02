import { AnyResolvedKeyframe } from "../animation/types"
import { cancelFrame, frame } from "../frameloop/frame"
import { Schedule } from "../frameloop/types"
import { MotionValue } from "../value"
import { numberValueTypes } from "../value/types/maps/number"
import { getValueAsType } from "../value/types/utils/get-as-type"

export class MotionValueState {
    latest: { [name: string]: AnyResolvedKeyframe } = {}

    private values = new Map<
        string,
        { value: MotionValue; onRemove: VoidFunction }
    >()

    /**
     * @param step - The frameloop step renders are scheduled in. Defaults
     * to `frame.render`. Effects that feed a render loop running in
     * `frame.render` (GPU scenes) should write in `frame.preRender`.
     */
    constructor(private step: Schedule = frame.render) {}

    set(
        name: string,
        value: MotionValue,
        render?: VoidFunction,
        computed?: MotionValue,
        useDefaultValueType = true
    ): VoidFunction {
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

            render && this.step(render)
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
}
