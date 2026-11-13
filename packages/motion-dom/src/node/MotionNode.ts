import type { Box } from "motion-utils"
import type { AnyResolvedKeyframe } from "../animation/types"
import type { KeyframeResolver } from "../animation/keyframes/KeyframesResolver"
import { frame } from "../frameloop/frame"
import type { Schedule } from "../frameloop/types"
import { createBox } from "../projection/geometry/models"
import { motionValue, MotionValue } from "../value"
import type { ResolvedValues } from "./types"

/**
 * Writes one or more keys of a node to its subject.
 */
export interface NodeRender {
    (): void

    /**
     * True if more than one key schedules this write, e.g. `x` and
     * `scale` both write `transform`. It then runs again when one of
     * its keys is removed, rather than being cancelled.
     */
    shared?: boolean
}

/**
 * Binds `key` of `subject` to `node`, by calling `node.set()` with the
 * function that writes it. `value` is undefined for a key that has a
 * latest value but no motion value.
 */
export type BindValue<Subject = any> = (
    subject: Subject,
    node: MotionNode<Subject>,
    key: string,
    value?: MotionValue
) => VoidFunction

/**
 * Reads the current value of `key` from `subject`, as the origin of an
 * animation.
 */
export type ReadValue<Subject = any> = (
    subject: Subject,
    key: string,
    target?: any
) => AnyResolvedKeyframe | null | undefined

export interface NodeBinding {
    render?: NodeRender
    stop?: VoidFunction
}

const noProps = {}

/**
 * The motion values of one subject (an element, a Three.js object, any
 * object) and the functions that write them to it.
 *
 * Renders are atomic: each key has a function that writes it, and a
 * change to a value schedules only that function. Keys that write the
 * same thing (`x` and `scale` both write `transform`) share a function,
 * which runs once per frame.
 *
 * Every write reads from `latestValues`, so a key can be given a value
 * without a motion value and rendered with `render()`.
 */
export class MotionNode<Subject = any> {
    /**
     * The subject, or null if the node isn't mounted to one yet.
     */
    current: Subject | null = null

    /**
     * The latest value of each key. This is what gets written.
     */
    latestValues: ResolvedValues = {}

    /**
     * The motion values bound to this node.
     */
    values = new Map<string, MotionValue>()

    /**
     * Binds a key to the subject. Set by whatever renders the subject.
     */
    bind?: BindValue<Subject>

    /**
     * Reads a key from the subject.
     */
    read?: ReadValue<Subject>

    /**
     * Write functions shared between keys, by name, e.g. `transform`.
     */
    shared?: { [name: string]: NodeRender }

    /**
     * Resolves the keyframes of animations on this node's values.
     */
    KeyframeResolver?: typeof KeyframeResolver

    protected bindings = new Map<string, NodeBinding>()

    /**
     * Writes scheduled for the next flush, usually one or two. Tracked
     * with a count rather than truncating the array so no backing store
     * is reallocated every frame.
     */
    private pending: VoidFunction[] = []

    /**
     * @internal
     */
    numPending = 0

    /**
     * @param step - The frameloop step writes are scheduled in. Defaults
     * to `frame.render`. Nodes that feed a render loop running in
     * `frame.render` (GPU scenes) should write in `frame.preRender`.
     */
    constructor(protected step: Schedule = frame.render) {}

    /**
     * Bind `value` to `name`, writing it with `render` whenever it changes.
     *
     * @param render - Writes to the subject. Reads `latestValues`, or the
     * motion value itself. Keys that write the same thing pass the same
     * function, marked `shared`.
     */
    set(name: string, value?: MotionValue, render?: NodeRender): VoidFunction {
        this.unbind(name)

        const binding: NodeBinding = { render }
        this.bindings.set(name, binding)

        if (value) {
            this.values.set(name, value)

            /**
             * Values created ahead of a DOM read start out undefined
             * and have nothing to render until they're set.
             */
            const latest = value.get()
            if (latest !== undefined) {
                this.latestValues[name] = latest
                render && !this.isSilent && this.schedule(render)
            }

            binding.stop = value.on("change", (v: AnyResolvedKeyframe) => {
                this.latestValues[name] = v
                this.onChange?.(name)
                render && this.schedule(render)
            })
        } else if (render) {
            this.schedule(render)
        }

        /**
         * Stops writing the key. Its latest value stays, as what was
         * last written to the subject does. A later set() of the same
         * name has already removed this binding, so leave the one that
         * replaced it.
         */
        return () => {
            if (this.bindings.get(name) === binding) {
                this.unbind(name)
                this.values.delete(name)
            }
        }
    }

    /**
     * True while binding values the subject already shows, so binding
     * them writes nothing.
     */
    protected isSilent?: boolean

    /**
     * Called when a bound value changes, before its write is scheduled.
     */
    protected onChange?(name: string): void

    protected unbind(name: string) {
        const binding = this.bindings.get(name)
        if (!binding) return

        const { render } = binding
        binding.stop?.()

        /**
         * A write shared with other keys runs again without this one,
         * e.g. `transform` is written without `x`. Any other write is
         * cancelled.
         */
        if (render) {
            if (render.shared) {
                this.schedule(render)
            } else {
                const { pending } = this
                for (let i = 0; i < this.numPending; i++) {
                    if (pending[i] === render) {
                        pending[i] = pending[--this.numPending]
                    }
                }
            }
        }

        this.bindings.delete(name)
    }

    /**
     * Bind a key to the subject, with the motion value it has, if any.
     */
    protected bindValue(name: string, value?: MotionValue) {
        this.bind
            ? this.bind(this.current!, this, name, value)
            : this.set(name, value)
    }

    /**
     * Add a motion value and bind it to the subject, if there is one.
     * A value that starts undefined (it's read from the subject when it
     * animates) leaves the key's latest value in place.
     */
    addValue(name: string, value: MotionValue) {
        if (value === this.values.get(name)) return
        this.unbind(name)
        this.values.set(name, value)

        const latest = value.get()
        if (latest !== undefined) this.latestValues[name] = latest

        this.current && this.bindValue(name, value)
    }

    /**
     * Remove a motion value and what binds it to the subject.
     */
    removeValue(name: string) {
        this.unbind(name)
        this.values.delete(name)
        delete this.latestValues[name]
    }

    /**
     * Get the motion value for a key. If called with a default value,
     * one is made if none exists.
     */
    getValue(name: string): MotionValue | undefined
    getValue(name: string, defaultValue: AnyResolvedKeyframe | null): MotionValue
    getValue(
        name: string,
        defaultValue?: AnyResolvedKeyframe | null
    ): MotionValue | undefined {
        let value = this.values.get(name)

        if (!value && defaultValue !== undefined) {
            value = motionValue(defaultValue ?? this.getDefaultValue?.(name), {
                owner: this,
            })
            this.addValue(name, value)
        }

        return value
    }

    /**
     * The value getValue starts a new motion value from when it isn't
     * given a default. Without it, values start unread and the keyframe
     * resolver reads their origin.
     */
    getDefaultValue?(name: string): AnyResolvedKeyframe | undefined

    /**
     * The current value of a key, read from the subject if the node has
     * never been given one.
     */
    readValue(name: string, target?: any): any {
        return (
            this.latestValues[name] ??
            (this.current && this.read?.(this.current, name, target))
        )
    }

    protected queue(render: VoidFunction) {
        const { pending, numPending } = this

        for (let i = 0; i < numPending; i++) {
            if (pending[i] === render) return
        }

        pending[this.numPending++] = render
    }

    /**
     * `immediate`, so a write scheduled by something else in the same
     * frameloop step is flushed in this frame.
     */
    protected schedule(render: VoidFunction) {
        this.numPending || this.step(this.flush, false, true)
        this.queue(render)
    }

    /**
     * Run the pending writes. Resetting the count first means a write
     * scheduled while flushing lands in the next frame, as with the
     * frameloop itself.
     */
    flush = () => {
        const { pending, numPending } = this
        this.numPending = 0
        for (let i = 0; i < numPending; i++) pending[i]()
        this.numPending && this.step(this.flush)
    }

    /**
     * Queue every key that has a value. One that hasn't been read from
     * the subject yet has nothing to write, and writing first could
     * change what is read.
     */
    protected queueAll() {
        this.bindings.forEach(
            ({ render }, name) =>
                render &&
                this.latestValues[name] !== undefined &&
                this.queue(render)
        )
    }

    /**
     * Write every key now, e.g. so the subject can be measured.
     */
    render = () => {
        if (!this.current) return
        this.queueAll()
        this.flush()
    }

    measureViewportBox(): Box {
        return createBox()
    }

    getProps(): any {
        return noProps
    }
}

/**
 * Detach every value from a node and return them, so another node can
 * take them over.
 */
export function releaseNode(node: MotionNode) {
    const values = new Map(node.values)
    values.forEach((_, name) => node.removeValue(name))
    node.shared = undefined
    node.numPending = 0
    return values
}
