"use client"

import * as motion from "motion/react-client"
import { forwardRef, ReactNode } from "react"

const Component = forwardRef(function Component(
    { children }: { children: (p: { test: boolean }) => ReactNode },
    ref: React.Ref<HTMLDivElement>
) {
    return <div ref={ref}>{children({ test: true })}</div>
})

export const MotionComponent = motion.create(Component)

export const MotionWithRenderChildren = () => {
    return <MotionComponent>{({ test }) => <div>{test}</div>}</MotionComponent>
}
