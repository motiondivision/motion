"use client"

import { AnimatePresence, MotionConfig } from "motion/react"
import * as motion from "motion/react-client"
import * as m from "motion/react-m"
import { forwardRef, ReactNode } from "react"

const Component = forwardRef(function Component(
    { children }: { children: (p: { test: boolean }) => ReactNode },
    ref: React.Ref<HTMLDivElement>
) {
    return <div ref={ref}>{children({ test: true })}</div>
})

const MotionComponent = motion.create(Component)

export default function Page() {
    return (
        <MotionConfig>
            <AnimatePresence>
                <motion.div id="test">Hello World</motion.div>
                <m.div id="m-test">Hello World</m.div>
            </AnimatePresence>
            <MotionComponent>{({ test }) => <div>{test}</div>}</MotionComponent>
        </MotionConfig>
    )
}
