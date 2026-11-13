import {
    Box,
    isNumericalString,
    isZeroValueString,
    SubscriptionManager,
    warnOnce,
} from "motion-utils"
import type { KeyframeResolver } from "../animation/keyframes/KeyframesResolver"
import { MotionNode } from "../node/MotionNode"
import type { AnyResolvedKeyframe } from "../animation/types"
import { acceleratedValues } from "../animation/waapi/utils/accelerated-values"
import { transformGroups } from "../animation/waapi/transforms/groups"
import { cancelFrame, frame } from "../frameloop"
import { microtask } from "../frameloop/microtask"
import type { MotionNodeOptions } from "../node/types"
import { createBox } from "../projection/geometry/models"
import type { MotionValue } from "../value"
import { complex } from "../value/types/complex"
import { getAnimatableNone } from "../value/types/utils/animatable-none"
import { isMotionValue } from "../value/utils/is-motion-value"
import { Feature } from "./Feature"
import { nodeStore } from "./store"
import {
    FeatureDefinitions,
    MotionConfigContextProps,
    PresenceContextProps,
    ReducedMotionConfig,
    ResolvedValues,
    VisualElementEventCallbacks,
    VisualElementOptions,
} from "./types"
import { AnimationState } from "./utils/animation-state"
import {
    isControllingVariants as checkIsControllingVariants,
    isVariantNode as checkIsVariantNode,
} from "./utils/is-controlling-variants"
import { transformProps } from "./utils/keys-transform"
import { updateMotionValuesFromProps } from "./utils/motion-values"
import {
    hasReducedMotionListener,
    initPrefersReducedMotion,
    prefersReducedMotion,
} from "./utils/reduced-motion"

const propEventHandlers = [
    "AnimationStart",
    "AnimationComplete",
    "Update",
    "BeforeLayoutMeasure",
    "LayoutMeasure",
    "LayoutAnimationStart",
    "LayoutAnimationComplete",
] as const

/**
 * Static feature definitions - can be injected by framework layer
 */
let featureDefinitions: Partial<FeatureDefinitions> = {}

/**
 * Set feature definitions for all VisualElements.
 * This should be called by the framework layer (e.g., framer-motion) during initialization.
 */
export function setFeatureDefinitions(
    definitions: Partial<FeatureDefinitions>
) {
    featureDefinitions = definitions
}

/**
 * Get the current feature definitions
 */
export function getFeatureDefinitions(): Partial<FeatureDefinitions> {
    return featureDefinitions
}

/**
 * Motion style type - a subset of CSS properties that can contain motion values
 */
export type MotionStyle = {
    [K: string]: AnyResolvedKeyframe | MotionValue | undefined
}

/**
 * A VisualElement is the MotionNode of a component: it adds the props,
 * variants, features and presence that a framework drives a subject
 * with. Its values are stored and written by MotionNode.
 */
export abstract class VisualElement<
    Instance = unknown,
    _RenderState = unknown,
    Options extends {} = {}
> extends MotionNode<Instance> {
    /**
     * VisualElements are arranged in trees mirroring that of the React tree.
     * Each type of VisualElement has a unique name, to detect when we're crossing
     * type boundaries within that tree.
     */
    abstract type: string

    /**
     * An `Array.sort` compatible function that will compare two Instances and
     * compare their respective positions within the tree.
     */
    abstract sortInstanceNodePosition(a: Instance, b: Instance): number

    /**
     * Measure the viewport-relative bounding box of the Instance.
     */
    abstract measureInstanceViewportBox(
        instance: Instance,
        props: MotionNodeOptions & Partial<MotionConfigContextProps>
    ): Box

    /**
     * When a value has been removed from all animation props we need to
     * pick a target to animate back to. For instance, for HTMLElements
     * we can look in the style prop.
     */
    abstract getBaseTargetFromProps(
        props: MotionNodeOptions,
        key: string
    ): AnyResolvedKeyframe | undefined | MotionValue

    /**
     * When we first animate to a value we need to animate it *from* a value.
     * Often this have been specified via the initial prop but it might be
     * that the value needs to be read from the Instance.
     */
    abstract readValueFromInstance(
        instance: Instance,
        key: string,
        options: Options
    ): AnyResolvedKeyframe | null | undefined

    /**
     * If the component child is provided as a motion value, handle subscriptions
     * with the renderer-specific VisualElement.
     */
    handleChildMotionValue?(): void

    /**
     * This method takes React props and returns found MotionValues. For example, HTML
     * MotionValues will be found within the style prop, whereas for Three.js within attribute arrays.
     *
     * This isn't an abstract method as it needs calling in the constructor, but it is
     * intended to be one.
     */
    scrapeMotionValuesFromProps(
        _props: MotionNodeOptions,
        _prevProps: MotionNodeOptions,
        _visualElement: VisualElement
    ): {
        [key: string]: MotionValue | AnyResolvedKeyframe
    } {
        return {}
    }

    /**
     * A reference to the parent VisualElement (if exists).
     */
    parent: VisualElement | undefined

    /**
     * A set containing references to this VisualElement's children.
     */
    children = new Set<VisualElement>()

    /**
     * A set containing the latest children of this VisualElement. This is flushed
     * at the start of every commit. We use it to calculate the stagger delay
     * for newly-added children.
     */
    enteringChildren?: Set<VisualElement>

    /**
     * The depth of this VisualElement within the overall VisualElement tree.
     */
    depth: number

    /**
     * Determine what role this visual element should take in the variant tree.
     */
    isVariantNode: boolean
    isControllingVariants: boolean

    /**
     * If this component is part of the variant tree, it should track
     * any children that are also part of the tree. This is essentially
     * a shadow tree to simplify logic around how to stagger over children.
     */
    variantChildren?: Set<VisualElement>

    /**
     * Decides whether this VisualElement should animate in reduced motion
     * mode.
     *
     * TODO: This is currently set on every individual VisualElement but feels
     * like it could be set globally.
     */
    shouldReduceMotion: boolean | null = null

    /**
     * Decides whether animations should be skipped for this VisualElement.
     * Useful for E2E tests and visual regression testing.
     */
    shouldSkipAnimations: boolean = false

    /**
     * Normally, if a component is controlled by a parent's variants, it can
     * rely on that ancestor to trigger animations further down the tree.
     * However, if a component is created after its parent is mounted, the parent
     * won't trigger that mount animation so the child needs to.
     *
     * TODO: This might be better replaced with a method isParentMounted
     */
    manuallyAnimateOnMount: boolean

    /**
     * This can be set by AnimatePresence to force components that mount
     * at the same time as it to mount as if they have initial={false} set.
     */
    blockInitialAnimation: boolean

    /**
     * A reference to this VisualElement's projection node, used in layout animations.
     */
    projection?: any

    /**
     * The AnimationState, this is hydrated by the animation Feature.
     */
    animationState?: AnimationState

    /**
     * Resolves this element's keyframes. Left unset, values use the
     * default KeyframeResolver.
     */
    KeyframeResolver?: typeof KeyframeResolver

    /**
     * The options used to create this VisualElement. The Options type is defined
     * by the inheriting VisualElement and is passed straight through to the render functions.
     */
    readonly options: Options

    /**
     * A reference to the latest props provided to the VisualElement's host React component.
     */
    props: MotionNodeOptions
    prevProps?: MotionNodeOptions

    presenceContext: PresenceContextProps | null
    prevPresenceContext?: PresenceContextProps | null

    /**
     * Cleanup functions for active features (hover/tap/exit etc)
     */
    private features: {
        [K in keyof FeatureDefinitions]?: Feature<Instance>
    } = {}

    /**
     * A reference to the ReducedMotionConfig passed to the VisualElement's host React component.
     */
    private reducedMotionConfig: ReducedMotionConfig | undefined

    /**
     * A reference to the skipAnimations config passed to the VisualElement's host React component.
     */
    private skipAnimationsConfig: boolean | undefined

    /**
     * On mount, this will be hydrated with a callback to disconnect
     * this visual element from its parent on unmount.
     */
    private removeFromVariantTree: undefined | VoidFunction

    /**
     * A reference to the previously-provided motion values as returned
     * from scrapeMotionValuesFromProps. We use the keys in here to determine
     * if any motion values need to be removed after props are updated.
     */
    private prevMotionValues: MotionStyle = {}

    /**
     * When values are removed from all animation props we need to search
     * for a fallback value to animate to. These values are tracked in baseTarget.
     * @internal
     */
    baseTarget: ResolvedValues

    /**
     * Create an object of the values we initially animated from (if initial prop present).
     * @internal
     */
    initialValues: ResolvedValues

    /**
     * Track whether this element has been mounted before, to detect
     * remounts after Suspense unmount/remount cycles.
     */
    private hasBeenMounted?: boolean

    /**
     * An object containing a SubscriptionManager for each active event.
     */
    private events: {
        [key: string]: SubscriptionManager<any>
    } = {}

    /**
     * An object containing an unsubscribe function for each prop event subscription.
     * For example, every "Update" event can have multiple subscribers via
     * VisualElement.on(), but only one of those can be defined via the onUpdate prop.
     */
    private propEventSubscriptions: {
        [key: string]: VoidFunction | undefined
    } = {}

    constructor(
        {
            parent,
            props,
            presenceContext,
            reducedMotionConfig,
            skipAnimations,
            blockInitialAnimation,
            visualState,
        }: VisualElementOptions<Instance>,
        options: Options = {} as any
    ) {
        super()
        const { latestValues } = visualState
        this.latestValues = latestValues
        this.baseTarget = { ...latestValues }
        this.initialValues = props.initial ? { ...latestValues } : {}
        this.parent = parent
        this.props = props
        this.presenceContext = presenceContext
        this.depth = parent ? parent.depth + 1 : 0
        this.reducedMotionConfig = reducedMotionConfig
        this.skipAnimationsConfig = skipAnimations
        this.options = options
        this.blockInitialAnimation = Boolean(blockInitialAnimation)

        this.isControllingVariants = checkIsControllingVariants(props)
        this.isVariantNode = checkIsVariantNode(props)
        if (this.isVariantNode) {
            this.variantChildren = new Set()
        }

        this.manuallyAnimateOnMount = Boolean(parent && parent.current)

        /**
         * Any motion values that are provided to the element when created
         * aren't yet bound to the element, as this would technically be impure.
         * However, we iterate through the motion values and set them to the
         * initial values for this component.
         *
         * TODO: This is impure and we should look at changing this to run on mount.
         * Doing so will break some tests but this isn't necessarily a breaking change,
         * more a reflection of the test.
         */
        const initialMotionValues = this.scrapeMotionValuesFromProps(
            props,
            {},
            this
        )

        for (const key in initialMotionValues) {
            const value = initialMotionValues[key]

            if (
                key !== "willChange" &&
                latestValues[key] !== undefined &&
                isMotionValue(value)
            ) {
                value.set(latestValues[key])
            }
        }
    }

    mount(instance: Instance) {
        /**
         * If this element has been mounted before (e.g. after a Suspense
         * unmount/remount), reset motion values to their initial state
         * so animations replay correctly from initial → animate, unless
         * the presence asks to keep them or the element is only shown
         * again to exit (#4049).
         */
        const presence = this.presenceContext
        if (
            this.hasBeenMounted &&
            presence?.isPresent !== false &&
            !presence?.keepValuesOnRemount
        ) {
            for (const key in this.initialValues) {
                this.values.get(key)?.jump(this.initialValues[key])
                this.latestValues[key] = this.initialValues[key]
            }
        }

        this.current = instance

        nodeStore.set(instance, this)

        this.projection?.instance || this.projection?.mount(instance)

        /**
         * Join the closest variant node above, so its variant changes
         * propagate here, unless inherit={false} cuts the chain.
         */
        if (this.isVariantNode && !this.isControllingVariants) {
            let node: VisualElement | undefined | false = this
            do node = node.props.inherit !== false && node.parent
            while (node && !node.isVariantNode)

            if (node) {
                const { variantChildren } = node
                variantChildren!.add(this)
                this.removeFromVariantTree = () => variantChildren!.delete(this)
            }
        }

        this.values.forEach((value, key) => this.bindValue(key, value))

        /**
         * A subject that's shown again can be showing anything.
         */
        this.hasBeenMounted && this.scheduleRender()

        /**
         * Determine reduced motion preference. Only initialize the matchMedia
         * listener if we actually need the dynamic value (i.e., when config
         * is neither "never" nor "always").
         */
        const { reducedMotionConfig } = this
        this.shouldReduceMotion =
            reducedMotionConfig !== "never" &&
            (reducedMotionConfig === "always" ||
                (hasReducedMotionListener.current || initPrefersReducedMotion(),
                prefersReducedMotion.current))

        if (process.env.NODE_ENV !== "production") {
            warnOnce(
                this.shouldReduceMotion !== true,
                "You have Reduced Motion enabled on your device. Animations may not appear as expected.",
                "reduced-motion-disabled"
            )
        }

        /**
         * Set whether animations should be skipped based on the config.
         */
        this.shouldSkipAnimations = this.skipAnimationsConfig ?? false

        this.parent?.addChild(this)

        this.update(this.props, this.presenceContext)

        this.hasBeenMounted = true
    }

    unmount() {
        this.projection?.unmount()
        cancelFrame(this.notifyUpdate)

        /**
         * Stop listening to every value, keeping the values themselves,
         * as the subject may come back.
         */
        this.bindings.forEach((binding) => binding.stop?.())
        this.bindings.clear()
        this.shared = undefined
        this.numPending = 0
        this.removeFromVariantTree?.()
        this.parent?.removeChild(this)

        for (const key in this.events) {
            this.events[key].clear()
        }

        for (const key in this.features) {
            const feature = this.features[key as keyof typeof this.features]
            if (feature) {
                feature.unmount()
                feature.isMounted = false
            }
        }
        this.current = null
    }

    addChild(child: VisualElement) {
        this.children.add(child)
        ;(this.enteringChildren || (this.enteringChildren = new Set())).add(
            child
        )
    }

    removeChild(child: VisualElement) {
        this.children.delete(child)
        this.enteringChildren?.delete(child)
    }

    protected bindValue(key: string, value?: MotionValue) {
        const accelerate = value?.accelerate
        if (
            accelerate?.bind &&
            acceleratedValues.has(key) &&
            this.current instanceof HTMLElement
        ) {
            this.unbind(key)
            this.bindings.set(key, {
                stop: accelerate.bind(this.current, key, accelerate),
            })
            return
        }

        /**
         * The framework renders a value it binds, and one made to
         * animate starts from what the subject shows.
         */
        this.isSilent = true
        super.bindValue(key, value)
        this.isSilent = false

        if (
            value &&
            typeof window !== "undefined" &&
            (window as any).MotionCheckAppearSync
        ) {
            const binding = this.bindings.get(key)
            if (binding) {
                const { stop } = binding
                const removeSyncCheck = (window as any).MotionCheckAppearSync(
                    this,
                    key,
                    value
                )
                binding.stop = () => {
                    stop?.()
                    removeSyncCheck?.()
                }
            }
        }
    }

    hasValue(key: string) {
        return this.values.has(key)
    }

    getStaticValue(key: string) {
        return this.latestValues[key]
    }

    /**
     * Set the latest value of a key without a motion value. It's written
     * by the next render.
     */
    setStaticValue(key: string, value: AnyResolvedKeyframe) {
        this.latestValues[key] = value
    }

    /**
     * Keys that have a latest value but no motion value are bound when
     * they're first rendered.
     */
    protected queueAll() {
        for (const key in this.latestValues) {
            this.bindings.has(key) || this.bindValue(key)
        }

        super.queueAll()
    }

    /**
     * Schedule every key to be written in the next frame. Before mount
     * there's nothing to write to, and the component's first styles
     * are rendered from its latest values.
     */
    scheduleRender = () => {
        if (!this.current) return
        this.requestFlush()
        this.queueAll()
    }

    protected onChange(key: string) {
        this.props.onUpdate && frame.preRender(this.notifyUpdate)

        if (this.projection && transformProps.has(key)) {
            this.projection.isTransformDirty = true
        }
    }

    sortNodePosition(other: VisualElement<Instance>) {
        /**
         * If either node isn't mounted, or they aren't even of the same type,
         * we can't compare their document order.
         */
        if (
            !this.current ||
            !other.current ||
            !this.sortInstanceNodePosition ||
            this.type !== other.type
        ) {
            return 0
        }

        return this.sortInstanceNodePosition(
            this.current as Instance,
            other.current as Instance
        )
    }

    updateFeatures() {
        let key: keyof typeof featureDefinitions = "animation"

        for (key in featureDefinitions) {
            const featureDefinition = featureDefinitions[key]

            if (!featureDefinition) continue

            const { isEnabled, Feature: FeatureConstructor } = featureDefinition

            /**
             * If this feature is enabled but not active, make a new instance.
             */
            if (
                !this.features[key] &&
                FeatureConstructor &&
                isEnabled(this.props)
            ) {
                this.features[key] = new FeatureConstructor(this) as any
            }

            /**
             * If we have a feature, mount or update it.
             */
            if (this.features[key]) {
                const feature = this.features[key]!
                if (feature.isMounted) {
                    feature.update()
                } else {
                    feature.mount()
                    feature.isMounted = true
                }
            }
        }
    }

    notifyUpdate = () => this.notify("Update", this.latestValues)

    /**
     * Measure the current viewport box with or without transforms.
     * Only measures axis-aligned boxes, rotate and skew must be manually
     * removed with a re-render to work.
     */
    measureViewportBox() {
        return this.current
            ? this.measureInstanceViewportBox(this.current, this.props)
            : createBox()
    }

    /**
     * Update the provided props. Ensure any newly-added motion values are
     * added to our map, old ones removed, and listeners updated.
     */
    update(
        props: MotionNodeOptions,
        presenceContext: PresenceContextProps | null
    ) {
        const { transformTemplate, onUpdate } = this.props

        if (props.transformTemplate || transformTemplate) {
            this.scheduleRender()
        }

        /**
         * Transforms on the compositor can't use a new transformTemplate
         * or onUpdate, so move them to the main thread.
         */
        if (
            (props.transformTemplate && !transformTemplate) ||
            (props.onUpdate && !onUpdate)
        ) {
            transformGroups.get(this.current!)?.demote()
        }

        this.prevProps = this.props
        this.props = props

        this.prevPresenceContext = this.presenceContext
        this.presenceContext = presenceContext

        /**
         * Update prop event handlers ie onAnimationStart, onAnimationComplete
         */
        for (let i = 0; i < propEventHandlers.length; i++) {
            const key = propEventHandlers[i]
            const listener = props[("on" + key) as keyof typeof props]

            /**
             * Replaced rather than deleted, as delete is slow even when
             * there's nothing to remove.
             */
            this.propEventSubscriptions[key]?.()
            this.propEventSubscriptions[key] = listener
                ? this.on(key as any, listener)
                : undefined
        }

        this.prevMotionValues = updateMotionValuesFromProps(
            this,
            this.scrapeMotionValuesFromProps(props, this.prevProps || {}, this),
            this.prevMotionValues
        )

        this.handleChildMotionValue?.()
    }

    getProps() {
        return this.props
    }

    /**
     * Returns the variant definition with a given name.
     */
    getVariant(name: string) {
        return this.props.variants?.[name]
    }

    /**
     * Returns the defined default transition on this component.
     */
    getDefaultTransition() {
        return this.props.transition
    }

    getTransformPagePoint() {
        return (this.props as any).transformPagePoint
    }

    /**
     * Get a motion value for this key. If called with a default
     * value, we'll create one if none exists.
     */
    getValue(key: string): MotionValue | undefined
    getValue(key: string, defaultValue: AnyResolvedKeyframe | null): MotionValue
    getValue(
        key: string,
        defaultValue?: AnyResolvedKeyframe | null
    ): MotionValue | undefined {
        return (
            this.props.values?.[key] || super.getValue(key, defaultValue as any)
        )
    }

    /**
     * If we're trying to animate to a previously unencountered value,
     * we need to check for it in our state and as a last resort read it
     * directly from the instance (which might have performance implications).
     */
    readValue(key: string, target?: AnyResolvedKeyframe | null) {
        let value =
            this.latestValues[key] !== undefined || !this.current
                ? this.latestValues[key]
                : this.getBaseTargetFromProps(this.props, key) ??
                  this.readValueFromInstance(this.current, key, this.options)

        if (value !== undefined && value !== null) {
            if (
                typeof value === "string" &&
                (isNumericalString(value) || isZeroValueString(value))
            ) {
                // If this is a number read as a string, ie "0" or "200", convert it to a number
                value = parseFloat(value)
            } else if (
                /**
                 * If the value as read isn't animatable (e.g. "none") but
                 * the target is, derive an animatable none from the target.
                 * A value is animatable if it's a number or contains a
                 * number or color, which is cheaper to check than trying
                 * every value type in turn.
                 */
                typeof value !== "number" &&
                !complex.test(value) &&
                complex.test(target)
            ) {
                value = getAnimatableNone(key, target as string)
            }

            this.setBaseTarget(key, isMotionValue(value) ? value.get() : value)
        }

        return isMotionValue(value) ? value.get() : value
    }

    /**
     * Set the base target to later animate back to. This is currently
     * only hydrated on creation and when we first read a value.
     */
    setBaseTarget(key: string, value: AnyResolvedKeyframe) {
        this.baseTarget[key] = value
    }

    on<EventName extends keyof VisualElementEventCallbacks>(
        eventName: EventName,
        callback: VisualElementEventCallbacks[EventName]
    ) {
        return (
            this.events[eventName] ||
            (this.events[eventName] = new SubscriptionManager())
        ).add(callback)
    }

    notify<EventName extends keyof VisualElementEventCallbacks>(
        eventName: EventName,
        ...args: any
    ) {
        this.events[eventName]?.notify(...args)
    }

    scheduleRenderMicrotask() {
        microtask.render(this.render)
    }
}
