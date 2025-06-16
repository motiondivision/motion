let pendingRules: Record<string, Record<string, string>> = {}

let style: HTMLStyleElement | null = null

export const css = {
    set: (selector: string, values: Record<string, string>) => {
        pendingRules[selector] = values
    },

    commit: () => {
        if (!style) {
            style = document.createElement("style")
            style.id = "motion-view"
        }

        let cssText = ""

        for (const selector in pendingRules) {
            const rule = pendingRules[selector]
            cssText += `${selector} {\n`
            for (const [property, value] of Object.entries(rule)) {
                cssText += `  ${property}: ${value};\n`
            }
            cssText += "}\n"
        }

        style.textContent = cssText
        document.head.appendChild(style)

        pendingRules = {}
    },

    remove: () => {
        if (style && style.parentElement) {
            style.parentElement.removeChild(style)
        }
    },
}
