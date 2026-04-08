"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"

/**
 * Test: SVG styles should apply correctly on mount when using useTransform.
 * Reproduction for #2949: SVG transform-origin and styles not applying on mount.
 *
 * The bug: SVG elements with transforms derived from useTransform would have
 * incorrect transformOrigin and transformBox on initial mount, causing a visible
 * jump when the visual element takes over rendering.
 */
export function App() {
    const x = useMotionValue(50)

    // Derived transform values via useTransform
    const pathLength = useTransform(x, [0, 100], [0, 1])
    const opacity = useTransform(x, [0, 100], [0, 1])
    const fill = useTransform(x, [0, 100], ["#0000ff", "#ff0000"])

    return (
        <svg width="200" height="200" data-testid="svg">
            {/* Path with useTransform-derived pathLength + opacity + CSS transform */}
            <motion.path
                id="path"
                d="M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80"
                fill="none"
                stroke="black"
                strokeWidth="2"
                style={{ pathLength, opacity, x: 10, y: 10 }}
            />
            {/* Circle with useTransform-derived fill */}
            <motion.circle
                id="circle"
                cx="100"
                cy="100"
                r="40"
                fill={fill}
            />
            {/* Rect with static transform to test transformBox/transformOrigin */}
            <motion.rect
                id="rect"
                x="10"
                y="10"
                width="50"
                height="50"
                style={{ rotate: 45 }}
            />
        </svg>
    )
}
