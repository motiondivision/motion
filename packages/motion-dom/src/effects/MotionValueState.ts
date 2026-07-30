import { AnyResolvedKeyframe } from "../animation/types"
import { cancelFrame, frame } from "../frameloop/frame"
import { MotionValue } from "../value"

/**
 * A contributor to a composed output slot, e.g. `transform`. Receives the
 * output of the previous contributor in the chain and returns the new output.
 * Return `prev` to pass through unchanged.
 */
export type SlotBuilder = (
    state: MotionValueState,
    prev?: AnyResolvedKeyframe
) => AnyResolvedKeyframe | undefined

/**
 * Reserved slot contributor indexes. Lower indexes run first, later
 * contributors can wrap or override earlier output.
 */
export const slotBase = 0
export const slotOverride = 1

export class MotionValueState {
    latest: { [name: string]: AnyResolvedKeyframe }

    private values = new Map<
        string,
        {
            value: MotionValue
            onRemove: VoidFunction
            computed?: MotionValue
            render?: VoidFunction
        }
    >()

    constructor(latest: { [name: string]: AnyResolvedKeyframe } = {}) {
        this.latest = latest
    }

    /**
     * Ordered contributor chains for composed slots like `transform`,
     * keyed by output name. Chains are sparse arrays indexed by priority.
     */
    private builders?: Map<string, Array<SlotBuilder | undefined>>

    set(
        name: string,
        value: MotionValue,
        render?: VoidFunction,
        computed?: MotionValue,
        track = true
    ) {
        const existingValue = this.values.get(name)

        if (existingValue) {
            existingValue.onRemove()
        }

        /**
         * Composed slots like `transform` use a placeholder MotionValue
         * purely as a dirty signal - their placeholder value shouldn't
         * be tracked in latest.
         */
        const onChange = track
            ? () => {
                  this.latest[name] = value.get()

                  render && frame.render(render)
              }
            : () => {
                  render && frame.render(render)
              }

        /**
         * Track the latest value immediately, but don't schedule a render.
         * Renders are scheduled by value changes, or explicitly via
         * scheduleRender() - frameworks like React render initial styles
         * themselves.
         */
        if (track) {
            this.latest[name] = value.get()
        }

        const cancelOnChange = value.on("change", onChange)

        computed && value.addDependent(computed)

        const remove = () => {
            cancelOnChange()
            render && cancelFrame(render)
            this.values.delete(name)
            computed && value.removeDependent(computed)
        }

        this.values.set(name, { value, onRemove: remove, computed, render })

        return remove
    }

    /**
     * Schedule a render of a value, or of the slot it contributes to.
     * Used by effects to render initial values on creation.
     */
    scheduleRender(name: string) {
        const existingValue = this.values.get(name)

        if (existingValue) {
            existingValue.render && frame.render(existingValue.render)
            existingValue.computed?.dirty()
        }
    }

    get(name: string): MotionValue | undefined {
        return this.values.get(name)?.value
    }

    /**
     * Fully remove a value from the state. Unlike the unsubscribe function
     * returned from set(), this also removes the value from latest and
     * re-renders any slot it contributed to, dropping it from the output.
     */
    remove(name: string) {
        const existingValue = this.values.get(name)

        if (existingValue) {
            existingValue.onRemove()
            delete this.latest[name]
            existingValue.computed?.dirty()
        }
    }

    /**
     * Unsubscribe every value and cancel any pending renders.
     */
    destroy() {
        this.values.forEach((value) => value.onRemove())
    }

    /**
     * Add a contributor to a slot's build chain. Triggers a re-render of
     * the slot, as does removing the contributor via the returned function.
     */
    contribute(name: string, index: number, builder: SlotBuilder) {
        this.builders ??= new Map()

        let chain = this.builders.get(name)

        if (!chain) {
            chain = []
            this.builders.set(name, chain)
        }

        chain[index] = builder
        this.get(name)?.dirty()

        return () => {
            chain[index] = undefined
            this.get(name)?.dirty()
        }
    }

    /**
     * Compose a slot's output by running its contributor chain in order.
     */
    build(name: string): AnyResolvedKeyframe | undefined {
        const chain = this.builders?.get(name)

        if (!chain) return undefined

        let output: AnyResolvedKeyframe | undefined

        for (let i = 0; i < chain.length; i++) {
            const builder = chain[i]
            if (builder) output = builder(this, output)
        }

        return output
    }
}
