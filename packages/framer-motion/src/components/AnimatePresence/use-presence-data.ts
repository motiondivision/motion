"use client"

import { useContext } from "react"
import { PresenceContext } from "../../context/PresenceContext"

export function usePresenceData() {
    const context = useContext(PresenceContext)
    return context ? context.custom : undefined
}
