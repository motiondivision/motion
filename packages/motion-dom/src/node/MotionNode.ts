import type { Box } from "motion-utils"
import type { AnyResolvedKeyframe } from "../animation/types"
import type { KeyframeResolver } from "../animation/keyframes/KeyframesResolver"
import { frame } from "../frameloop/frame"
import { frameData } from "../frameloop/frame-data"
import type { Schedule } from "../frameloop/types"
import { createBox } from "../projection/geometry/models"
import { motionValue, MotionValue } from "../value"
import type { ResolvedValues } from "./types"

/**
 * Writes one or more keys of a node to its subject.
 */
export interface NodeRender {
    /**
     * Given the value that changed when it's written as it changes.
     */
    (latest?: any): void

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

    /**
     * The value the binding listens to, and its listener. Kept here
     * rather than in a function that stops it, as there's one binding
     * per value of every subject.
     */
    value?: MotionValue
    onChange?: (v: any) => void

    /**
     * Anything else to stop with the binding.
     */
    stop?: VoidFunction
}

const noProps = {}

/**
 * Nodes with writes pending in a frame step, flushed by one callback
 * for the step rather than one for each node.
 */
interface Batch {
    nodes: MotionNode[]
    flush: VoidFunction
}

const batches = new Map<Schedule, Batch>()

function getBatch(step: Schedule) {
    let batch = batches.get(step)

    if (!batch) {
        const created: Batch = {
            nodes: [],
            flush: () => {
                const { nodes } = created
                created.nodes = []
                for (let i = 0; i < nodes.length; i++) nodes[i].flush()

                /**
                 * Nodes scheduled while flushing are the next batch,
                 * which runs in the next frame.
                 */
                created.nodes.length && step(created.flush)
            },
        }
        batches.set(step, (batch = created))
    }

    return batch
}

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

    protected bindings: { [name: string]: NodeBinding | undefined } = {}

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
     * True when the node is in its step's batch, to be flushed.
     */
    private isScheduled?: boolean

    /**
     * Every key is to be written by the next flush. The keys are
     * collected when it runs, once for any number of requests.
     */
    isAllPending?: boolean

    private batch: Batch

    /**
     * @param step - The frameloop step writes are scheduled in. Defaults
     * to `frame.render`. Nodes that feed a render loop running in
     * `frame.render` (GPU scenes) should write in `frame.preRender`.
     * @param isSync - During a frame, write each change as it's made
     * rather than in `step`, for subjects a write can't make the browser
     * lay out, like plain objects and 3D scenes. Outside a frame, changes
     * still wait for `step`.
     */
    constructor(
        protected step: Schedule = frame.render,
        private isSync?: boolean
    ) {
        this.batch = getBatch(step)
    }

    /**
     * Bind `value` to `name`, writing it with `render` whenever it changes.
     *
     * @param render - Writes to the subject. Reads `latestValues`, or the
     * motion value itself. Keys that write the same thing pass the same
     * function, marked `shared`.
     */
    set(name: string, value?: MotionValue, render?: NodeRender): VoidFunction {
        this.unbind(name)

        /**
         * Declared here, not beside the listener that uses them, as a
         * block with captured variables is allocated per call.
         */
        const { latestValues, isSync, onChange: notify } = this

        /**
         * The listener is in the literal so bindings share one shape.
         */
        const binding: NodeBinding = {
            render,
            value,
            onChange: undefined,
        }
        this.bindings[name] = binding

        if (value) {
            this.values.set(name, value)

            /**
             * Values created ahead of a DOM read start out undefined
             * and have nothing to render until they're set.
             */
            const latest = value.get()
            if (latest !== undefined) {
                latestValues[name] = latest
                render && !this.isSilent && this.schedule(render)
            }

            value.addChangeSubscriber(
                (binding.onChange = (v: AnyResolvedKeyframe) => {
                    /**
                     * A write made as the value changes is given the
                     * value, so it isn't kept in latestValues: with
                     * many subjects, that is one more object to touch
                     * for each change.
                     */
                    if (isSync && frameData.isProcessing) {
                        render?.(v)
                    } else {
                        latestValues[name] = v
                        notify?.call(this, name)
                        render && this.schedule(render)
                    }
                })
            )
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
            if (this.bindings[name] === binding) {
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
        const binding = this.bindings[name]
        if (!binding) return

        const { render } = binding
        this.stop(binding)

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

        this.bindings[name] = undefined
    }

    /**
     * Stop a binding listening to its value.
     */
    protected stop({ value, onChange, stop }: NodeBinding) {
        onChange && value!.removeChangeSubscriber(onChange)
        stop?.()
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

        /**
         * Binding a value also keeps it and its latest value, so
         * that's only done here when there's no subject to bind to.
         */
        if (this.current) return this.bindValue(name, value)

        this.unbind(name)
        this.values.set(name, value)

        const latest = value.get()
        if (latest !== undefined) this.latestValues[name] = latest
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
    getValue(
        name: string,
        defaultValue: AnyResolvedKeyframe | null
    ): MotionValue
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
     * Have the node flushed in its step. `immediate`, so a flush asked
     * for by something else in the same step runs in this frame.
     */
    requestFlush() {
        if (this.isScheduled) return
        this.isScheduled = true
        const { batch } = this
        batch.nodes.length || this.step(batch.flush, false, true)
        batch.nodes.push(this)
    }

    protected schedule(render: VoidFunction) {
        this.requestFlush()
        this.queue(render)
    }

    /**
     * Run the pending writes. Resetting the count first means a write
     * scheduled while flushing lands in the next frame, as with the
     * frameloop itself.
     */
    flush() {
        this.isScheduled = false
        if (this.isAllPending) {
            this.isAllPending = false
            this.queueAll()
        }
        const { pending, numPending } = this
        this.numPending = 0
        for (let i = 0; i < numPending; i++) pending[i]()
    }

    /**
     * Queue every key that has a value, or with `test`, those it passes.
     * One that hasn't been read from the subject yet has nothing to
     * write, and writing first could change what is read.
     */
    protected queueAll(test?: (name: string) => boolean) {
        const { bindings, latestValues } = this
        for (const name in bindings) {
            const render = bindings[name]?.render
            render &&
                latestValues[name] !== undefined &&
                (!test || test(name)) &&
                this.queue(render)
        }
    }

    /**
     * Write every key now, e.g. so the subject can be measured.
     */
    render() {
        if (!this.current) return
        this.isAllPending = true
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
    node.isAllPending = false
    return values
}
