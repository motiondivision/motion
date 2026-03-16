import {
    isValidElement,
    Children,
    ReactElement,
    ReactNode,
    cloneElement,
} from "react"

export type ComponentKey = string | number

export const getChildKey = (child: ReactElement<any>): ComponentKey =>
    child.key || ""

export function onlyElements(children: ReactNode): ReactElement<any>[] {
    const filtered: ReactElement<any>[] = []

    // We use forEach here instead of map as map mutates the component key by preprending `.$`
    Children.forEach(children, (child) => {
        if (isValidElement(child))
            filtered.push(
                child.key !== null
                    ? child
                    : cloneElement(child, { key: `.${filtered.length}` })
            )
    })

    return filtered
}
