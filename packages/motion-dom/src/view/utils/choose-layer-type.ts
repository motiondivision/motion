export function chooseLayerType(
    valueName: "layout" | "enter" | "exit" | "new" | "old"
): "group" | "old" | "new" {
    if (valueName === "layout") return "group"
    if (valueName === "enter" || valueName === "new") return "new"
    return "old"
}
