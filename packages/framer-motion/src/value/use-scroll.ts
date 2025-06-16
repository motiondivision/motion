import { motionValue } from "motion-dom"
import { warning } from "motion-utils"
import { RefObject, useEffect } from "react"
import { scroll } from "../render/dom/scroll"
import { ScrollInfoOptions } from "../render/dom/scroll/types"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"

export interface UseScrollOptions
    extends Omit<ScrollInfoOptions, "container" | "target"> {
    container?: RefObject<HTMLElement | null>
    target?: RefObject<HTMLElement | null>
    layoutEffect?: boolean
}

function refWarning(name: string, ref?: RefObject<HTMLElement | null>) {
    warning(
        Boolean(!ref || ref.current),
        `You have defined a ${name} options but the provided ref is not yet hydrated, probably because it's defined higher up the tree. Try calling useScroll() in the same component as the ref, or setting its \`layoutEffect: false\` option.`
    )
}

const createScrollMotionValues = () => ({
    scrollX: motionValue(0),
    scrollY: motionValue(0),
    scrollXProgress: motionValue(0),
    scrollYProgress: motionValue(0),
})

export function useScroll({
    container,
    target,
    layoutEffect = true,
    ...options
}: UseScrollOptions = {}) {
    const values = useConstant(createScrollMotionValues)

    const useLifecycleEffect = layoutEffect
        ? useIsomorphicLayoutEffect
        : useEffect

    useLifecycleEffect(() => {
        refWarning("target", target)
        refWarning("container", container)

        return scroll(
            (
                _progress: number,
                {
                    x,
                    y,
                }: {
                    x: { current: number; progress: number }
                    y: { current: number; progress: number }
                }
            ) => {
                values.scrollX.set(x.current)
                values.scrollXProgress.set(x.progress)
                values.scrollY.set(y.current)
                values.scrollYProgress.set(y.progress)
            },
            {
                ...options,
                container: container?.current || undefined,
                target: target?.current || undefined,
            }
        )
    }, [container, target, JSON.stringify(options.offset)])

    return values
}
