"use client"

import { forwardRef, ReactNode } from "react"

export const RenderChildren = forwardRef(function Component(
    { children }: { children: (p: { label: string }) => ReactNode },
    ref: React.Ref<HTMLDivElement>
) {
    return <div ref={ref}>{children({ label: "Hello World" })}</div>
})
