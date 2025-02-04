"use client"

import { extend } from "@react-three/fiber"
import { forwardRef, JSX } from "react"
import { mergeRefs } from "react-merge-refs"
import { PerspectiveCamera as PerspectiveCameraImpl } from "three"
import { motion } from "../render/motion"
import { ThreeMotionProps } from "../types"
import { LayoutCameraProps } from "./types"
import { useLayoutCamera } from "./use-layout-camera"

extend({ PerspectiveCamera: PerspectiveCameraImpl })

type Props = JSX.IntrinsicElements["perspectiveCamera"] &
    LayoutCameraProps &
    ThreeMotionProps

/**
 * Adapted from https://github.com/pmndrs/drei/blob/master/src/core/PerspectiveCamera.tsx
 *
 * @deprecated Motion 3D is deprecated.
 */
export const LayoutCamera = forwardRef((props: Props, ref) => {
    const { cameraRef } = useLayoutCamera<PerspectiveCameraImpl>(
        props,
        (size) => {
            const { current: cam } = cameraRef

            if (cam && !props.manual) {
                cam.aspect = size.width / size.height
                cam.updateProjectionMatrix()
            }
        }
    )

    return (
        <motion.perspectiveCamera
            ref={mergeRefs([cameraRef, ref]) as any}
            {...props}
        />
    )
})
