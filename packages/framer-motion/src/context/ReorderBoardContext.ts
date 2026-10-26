"use client"

import { createContext } from "react"
import type { ReorderBoardProps } from "../components/Reorder/types"

export const ReorderBoardContext =
    /* @__PURE__ */ createContext<ReorderBoardProps | null>(null)
