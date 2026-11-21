import { animations } from "../../motion/features/animations"
import { followAppearAnimations } from "./follow"

/**
 * The animation feature, for components whose enter animations start as
 * CSS. It leaves those to run.
 */
export function loadAnimations() {
    followAppearAnimations()
    return animations
}
