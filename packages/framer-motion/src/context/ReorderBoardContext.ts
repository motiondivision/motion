"use client"

import { createContext } from "react"
import type { ReorderBoardContextProps } from "../components/Reorder/types"

export const ReorderBoardContext =
    /* @__PURE__ */ createContext<ReorderBoardContextProps | null>(null)
