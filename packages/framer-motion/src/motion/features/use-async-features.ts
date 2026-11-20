import { useEffect, useState } from "react"
import { MotionProps } from "../types"
import { getInitializedFeatureDefinitions } from "./definitions"
import { loadFeatures } from "./load-features"
import { FeatureLoader, FeatureLoaders } from "./types"

/**
 * Load the features a component's props ask for, and render the component
 * again once they arrive so it can use them. Each loader is shared by every
 * component, so a feature is only fetched once.
 *
 * The fetch starts during render, not in an effect, so a server-rendered
 * page asks for its features while it hydrates rather than afterwards.
 */
export function useAsyncFeatures(props: MotionProps, loaders: FeatureLoaders) {
    const forceRender = useState(0)[1]
    const definitions = getInitializedFeatureDefinitions()
    let pending: FeatureLoader[] | undefined

    for (const name in loaders) {
        const loader = loaders[name]

        if (
            loader.isLoaded ||
            !loader.keys.some((key) => definitions[key]?.isEnabled(props))
        ) {
            continue
        }

        loader.promise ||= loader.load().then((features) => {
            loadFeatures(features)
            loader.isLoaded = true
        })
        ;(pending ||= []).push(loader)
    }

    useEffect(() => {
        if (!pending) return

        let isActive = true
        const update = () => isActive && forceRender((v) => v + 1)
        pending.forEach((loader) => loader.promise!.then(update))

        return () => {
            isActive = false
        }
    })
}
