import { camelToDash } from "motion-dom"

export const optimizedAppearDataId = "framerAppearId"

export const optimizedAppearDataAttribute =
    "data-" + camelToDash(optimizedAppearDataId) as "data-framer-appear-id"
