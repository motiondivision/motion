import { invariant } from "motion-utils"
import * as React from "react"
import { useConstant } from "../utils/use-constant"
import { LayoutGroup } from "./LayoutGroup"

let id = 0
export const AnimateSharedLayout: React.FunctionComponent<
    React.PropsWithChildren<unknown>
> = ({ children }: React.PropsWithChildren<{}>) => {
    React.useEffect(() => {
        invariant(
            false,
            "AnimateSharedLayout is deprecated: https://www.framer.com/docs/guide-upgrade/##shared-layout-animations"
        )
    }, [])

    return (
        <LayoutGroup id={useConstant(() => `asl-${id++}`)}>
            {children}
        </LayoutGroup>
    )
}
