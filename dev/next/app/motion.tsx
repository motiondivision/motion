"use client"

import { motion } from "motion/react"
import { RenderChildren } from "./render-children"

export const MotionComponent = motion.create(RenderChildren)

export const MotionWithRenderChildren = () => {
    return (
        <MotionComponent>
            {({ test }) => <div id="motion-render-children">{test}</div>}
        </MotionComponent>
    )
}
