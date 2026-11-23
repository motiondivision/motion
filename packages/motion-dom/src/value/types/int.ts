export const int = {
    test: (v: any) => typeof v === "number",
    parse: parseFloat,
    transform: Math.round,
}
