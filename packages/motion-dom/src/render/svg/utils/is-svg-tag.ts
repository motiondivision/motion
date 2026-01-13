export const isSVGTag = (tag: unknown) =>
    typeof tag === "string" && tag.toLowerCase() === "svg"
