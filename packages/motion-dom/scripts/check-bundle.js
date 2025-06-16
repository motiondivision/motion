const path = require("path")
const { readFileSync } = require("fs")

const file = readFileSync(
    path.join(__dirname, "../", "dist", "index.d.ts"),
    "utf8"
)

if (file.includes(`"react"`)) {
    throw new Error("DOM bundle includes reference to React")
}
