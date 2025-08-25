"use client"

import { useConstant } from "../../utils/use-constant"
import { WillChangeMotionValue } from "./WillChangeMotionValue"
import { WillChange } from "./types"

export function useWillChange(): WillChange {
    return useConstant(() => new WillChangeMotionValue("auto"))
}
