"use client"

import { createContext } from "react"
import type { PresenceContextProps } from "motion-dom"

export type { PresenceContextProps }

/**
 * @public
 */
export const PresenceContext =
    /* @__PURE__ */ createContext<PresenceContextProps | null>(null)
