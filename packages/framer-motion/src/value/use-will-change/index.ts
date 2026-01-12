"use client"

import type { WillChange } from "motion-dom"
import { useConstant } from "../../utils/use-constant"
import { WillChangeMotionValue } from "./WillChangeMotionValue"

export function useWillChange(): WillChange {
    return useConstant(() => new WillChangeMotionValue("auto"))
}
