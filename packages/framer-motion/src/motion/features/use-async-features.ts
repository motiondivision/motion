"use client"

import type { VisualElement } from "motion-dom"
import { noop, warnOnce } from "motion-utils"
import { useContext, useSyncExternalStore } from "react"
import { MotionContext, MotionContextProps } from "../../context/MotionContext"
import { SwitchLayoutGroupContext } from "../../context/SwitchLayoutGroupContext"
import { useConstant } from "../../utils/use-constant"
import { MotionProps } from "../types"
import { getInitializedFeatureDefinitions } from "./definitions"
import { loadFeatures } from "./load-features"
import { FeatureLoader, FeatureLoaders } from "./types"

interface Entry {
    context?: MotionContextProps
    parent?: MotionContextProps
    promotion?: any
    version: number
    /**
     * How many features had arrived when this last rendered.
     */
    arrived?: number
    onChange?: VoidFunction
    subscribe: (onChange: VoidFunction) => VoidFunction
    getVersion: () => number
}

/**
 * Each component that can fetch features, by the context it gives its
 * children, and those that are mounted.
 */
const entries = new WeakMap<MotionContextProps, Entry>()
const mounted = new Set<Entry>()

/**
 * How many times a feature has arrived.
 */
let arrived = 0

/**
 * Give a component the projection node it would have made while rendering,
 * had the feature been there. Its ancestors are given theirs first, as a
 * node finds its parent when it's made.
 *
 * Nodes are mounted once each has been made, as they are when made while
 * rendering. A node made after another has mounted with its layoutId
 * would take over from it.
 */
function ensureNode(
    context: MotionContextProps,
    ProjectionNode: any,
    made?: VisualElement[]
) {
    const entry = entries.get(context)
    const { visualElement } = context
    if (!entry || !visualElement || visualElement.projection) return

    entry.parent!.project?.(ProjectionNode, made)
    ProjectionNode.create(visualElement, visualElement.props, entry.promotion)
    made ? made.push(visualElement) : mountNode(visualElement)
}

const mountNode = (visualElement: VisualElement) =>
    visualElement.current &&
    visualElement.projection!.mount(visualElement.current)

/**
 * Give a component its node if the feature that makes them has arrived.
 */
const project = ({ context }: Entry, made?: VisualElement[]) => {
    const { layout, drag } = getInitializedFeatureDefinitions()
    const ProjectionNode = layout?.ProjectionNode || drag?.ProjectionNode
    ProjectionNode && ensureNode(context!, ProjectionNode, made)
}

/**
 * When a feature arrives, mounted components are given projection nodes
 * without rendering again. Only those whose props use the feature render,
 * to mount it.
 */
const notify = (keys: FeatureLoader["keys"]) => {
    const definitions = getInitializedFeatureDefinitions()
    const made: VisualElement[] = []

    arrived++
    for (const entry of mounted) project(entry, made)
    made.forEach(mountNode)

    /**
     * The props a component committed, not those of a render that React
     * can still discard.
     */
    for (const entry of mounted) {
        const { props } = entry.context!.visualElement!
        if (keys.some((key) => definitions[key]?.isEnabled(props))) {
            entry.version++
            entry.onChange!()
        }
    }
}

const createEntry = () => {
    const entry: Entry = {
        version: 0,
        getVersion: () => entry.version,
        subscribe: (onChange) => {
            entry.onChange = onChange
            mounted.add(entry)

            /**
             * A feature that arrived between this component's render and
             * now missed it. It's given its node, and React, which reads
             * the version again once it has subscribed, renders it.
             */
            project(entry)
            if (entry.arrived !== arrived) entry.version++

            return () => mounted.delete(entry)
        },
    }

    return entry
}

/**
 * How long to leave a feature that failed to load before a render asks
 * for it again.
 */
const retryDelay = 5000

const fetchFeature = (loaders: FeatureLoaders, name: string) => {
    const loader = loaders[name]

    return (loader.promise ||= loader.load().then(
        (features) => {
            loadFeatures(features)
            loader.isLoaded = true
            notify(loader.keys)
        },
        (error) => {
            /**
             * A later render asks again, as a failed request can succeed
             * once the network is back. Browsers that keep a failed
             * module, like Chrome, only fetch it again after a reload.
             */
            loader.promise = undefined
            loader.failedAt = Date.now()
            warnOnce(
                false,
                `${name} failed to load. A page reload may be needed: ${error}`
            )
            throw error
        }
    ))
}

/**
 * Fetch the features a component's props ask for. Each loader is shared by
 * every component, so a feature is only fetched once.
 *
 * The fetch starts during render, not in an effect, so a server-rendered
 * page asks for its features while it hydrates rather than afterwards.
 */
export function useAsyncFeatures(
    props: MotionProps,
    context: MotionContextProps,
    loaders: FeatureLoaders
) {
    const entry = useConstant(createEntry)
    entry.parent = useContext(MotionContext)
    entry.promotion = useContext(SwitchLayoutGroupContext)
    entry.arrived = arrived

    /**
     * A change of variant labels makes a new context, which is given its
     * visual element later in this render.
     */
    context.visualElement ||= entry.context?.visualElement
    entry.context = context
    entries.set(context, entry)

    /**
     * A component below this one that makes its projection node while it
     * renders gives this one its node first, if it rendered before the
     * feature arrived.
     */
    context.project ||= (ProjectionNode, made) =>
        ensureNode(context, ProjectionNode, made)

    useSyncExternalStore(entry.subscribe, entry.getVersion, entry.getVersion)

    const definitions = getInitializedFeatureDefinitions()

    for (const name in loaders) {
        const loader = loaders[name]
        const definition = definitions[loader.keys[0]] as any

        /**
         * The feature can also arrive from elsewhere, like a component
         * that bundles it, or a loadFeatures() call. Components that
         * rendered before it did are told once this render is done.
         */
        if (definition.Feature || definition.ProjectionNode) {
            if (!loader.isLoaded) {
                loader.isLoaded = true
                queueMicrotask(() => notify(loader.keys))
            }
            continue
        }

        if (
            loader.promise ||
            loader.failedAt! > Date.now() - retryDelay ||
            !loader.keys.some((key) => definitions[key]?.isEnabled(props))
        ) {
            continue
        }

        fetchFeature(loaders, name).catch(noop)
    }

    /**
     * A mounted component is given its node here rather than when it
     * makes its visual element, so the node is mounted too.
     */
    project(entry)
}

/**
 * Fetch every feature now, for instance before a test runs or ahead of an
 * interaction that needs one. Rejects if one fails to load, so catch it
 * where that's expected.
 */
export const preloadFeatures = (loaders: FeatureLoaders) =>
    Promise.all(Object.keys(loaders).map((name) => fetchFeature(loaders, name)))
