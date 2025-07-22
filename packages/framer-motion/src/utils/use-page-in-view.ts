"use client"

import { useEffect, useState } from "react"

export function usePageInView() {
    const [isInView, setIsInView] = useState(true)

    useEffect(() => {
        const handleVisibilityChange = () => setIsInView(!document.hidden)

        if (document.hidden) {
            handleVisibilityChange()
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            )
        }
    }, [])

    return isInView
}
