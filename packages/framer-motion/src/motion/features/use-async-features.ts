import { warnOnce } from "motion-utils"
import { useSyncExternalStore } from "react"
import { MotionProps } from "../types"
import { getInitializedFeatureDefinitions } from "./definitions"
import { loadFeatures } from "./load-features"
import { FeatureLoaders } from "./types"

/**
 * Every component that can fetch features renders again when one arrives,
 * in one commit and from the top of the tree down. With the layout feature
 * each of them makes its projection node then, parents before children,
 * as they would have if the feature had been there from the start.
 */
const listeners = new Set<VoidFunction>()
let version = 0

const subscribe = (listener: VoidFunction) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

const getVersion = () => version

const notify = () => {
    version++
    listeners.forEach((listener) => listener())
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
            notify()
        },
        (error) => {
            /**
             * A later render asks again, as a failed request can succeed
             * once the network is back.
             */
            loader.promise = undefined
            loader.failedAt = Date.now()
            warnOnce(
                false,
                `The ${name} feature failed to load, so ${name} props do nothing until it does: ${error}`
            )
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
export function useAsyncFeatures(props: MotionProps, loaders: FeatureLoaders) {
    useSyncExternalStore(subscribe, getVersion, getVersion)

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
                queueMicrotask(notify)
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

        fetchFeature(loaders, name)
    }
}

/**
 * Fetch every feature now, for instance before a test runs or ahead of an
 * interaction that needs one.
 */
export const preloadFeatures = (loaders: FeatureLoaders) =>
    Promise.all(Object.keys(loaders).map((name) => fetchFeature(loaders, name)))
