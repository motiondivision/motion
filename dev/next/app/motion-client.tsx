"use client"

import * as motion from "motion/react-client"
import { ReactNode } from "react"

export const Component = ({ children }: { children: ReactNode }) => {
    return <div id="motion-client-with-children">{children}</div>
}

export const MotionClientComponent = motion.create(Component)

export const MotionComponentWithChildren = () => {
    return <MotionClientComponent>Hello world</MotionClientComponent>
}
