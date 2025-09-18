"use client"

import { motion } from "motion/react"
import { RenderChildren } from "./render-children"

export const MotionRenderChildren = motion.create(RenderChildren)

export const MotionWithRenderChildren = (props) => {
    return (
        <MotionRenderChildren {...props}>
            {({ label }) => <div id="motion-render-children">{label}</div>}
        </MotionRenderChildren>
    )
}

const Custom = (props: React.HTMLProps<HTMLDivElement>) => {
    return <div id="motion-custom" {...props} />
}

export const MotionCustom = motion.create(Custom)

export const MotionDiv = motion.div
