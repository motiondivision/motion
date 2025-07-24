"use client"

import { forwardRef, ReactNode } from "react"

export const RenderChildren = forwardRef(function Component(
    { children }: { children: (p: { test: boolean }) => ReactNode },
    ref: React.Ref<HTMLDivElement>
) {
    return <div ref={ref}>{children({ test: true })}</div>
})
