"use client"

import { useEffect } from "react"

export function useUnmountEffect(callback: () => void) {
    return useEffect(() => () => callback(), [])
}
