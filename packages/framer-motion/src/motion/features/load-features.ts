import { setFeatureDefinitions } from "motion-dom"
import { getInitializedFeatureDefinitions } from "./definitions"
import { FeaturePackages } from "./types"

export function loadFeatures(features: FeaturePackages) {
    const featureDefinitions = getInitializedFeatureDefinitions()

    for (const key in features) {
        featureDefinitions[key as keyof typeof featureDefinitions] = {
            ...featureDefinitions[key as keyof typeof featureDefinitions],
            ...features[key as keyof typeof features],
        } as any
    }

    setFeatureDefinitions(featureDefinitions)
}
