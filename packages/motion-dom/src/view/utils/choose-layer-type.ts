export function chooseLayerType(
    valueName: "layout" | "enter" | "exit"
): "group" | "old" | "new" {
    if (valueName === "layout") return "group"
    return valueName === "enter" ? "new" : "old"
}
