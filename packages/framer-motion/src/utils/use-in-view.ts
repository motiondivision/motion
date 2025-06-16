import { RefObject, useEffect, useState } from "react"
import { inView, InViewOptions } from "../render/dom/viewport"

export interface UseInViewOptions
    extends Omit<InViewOptions, "root" | "amount"> {
    root?: RefObject<Element | null>
    once?: boolean
    amount?: "some" | "all" | number
    initial?: boolean
}

export function useInView(
    ref: RefObject<Element | null>,
    {
        root,
        margin,
        amount,
        once = false,
        initial = false,
    }: UseInViewOptions = {}
) {
    const [isInView, setInView] = useState(initial)

    useEffect(() => {
        if (!ref.current || (once && isInView)) return

        const onEnter = () => {
            setInView(true)

            return once ? undefined : () => setInView(false)
        }

        const options: InViewOptions = {
            root: (root && root.current) || undefined,
            margin,
            amount,
        }

        return inView(ref.current, onEnter, options)
    }, [root, ref, margin, once, amount])

    return isInView
}
