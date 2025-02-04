"use client"

import { extend } from "@react-three/fiber"
import { forwardRef, JSX } from "react"
import { mergeRefs } from "react-merge-refs"
import { OrthographicCamera as OrthographicCameraImpl } from "three"
import { motion } from "../render/motion"
import { ThreeMotionProps } from "../types"
import { LayoutCameraProps } from "./types"
import { useLayoutCamera } from "./use-layout-camera"

extend({ OrthographicCamera: OrthographicCameraImpl })

type Props = JSX.IntrinsicElements["orthographicCamera"] &
    LayoutCameraProps &
    ThreeMotionProps

/**
 * @deprecated Motion 3D is deprecated.
 */
export const LayoutOrthographicCamera = forwardRef((props: Props, ref) => {
    const { size, cameraRef } = useLayoutCamera<OrthographicCameraImpl>(
        props,
        (newSize) => {
            const { current: cam } = cameraRef

            if (cam) {
                cam.left = newSize.width / -2
                cam.right = newSize.width / 2
                cam.top = newSize.height / 2
                cam.bottom = newSize.height / -2
                cam.updateProjectionMatrix()
            }
        }
    )

    return (
        <motion.orthographicCamera
            left={size.width / -2}
            right={size.width / 2}
            top={size.height / 2}
            bottom={size.height / -2}
            ref={mergeRefs([cameraRef, ref]) as any}
            {...props}
        />
    )
})
