import { int } from "../int"
import { alpha } from "../numbers"
import { px } from "../numbers/units"
import { transformValueTypes } from "./transform"
import { ValueTypeMap } from "./types"

export const numberValueTypes: ValueTypeMap = {
    // Border props
    borderWidth: px,
    borderTopWidth: px,
    borderRightWidth: px,
    borderBottomWidth: px,
    borderLeftWidth: px,
    borderRadius: px,
    radius: px,
    borderTopLeftRadius: px,
    borderTopRightRadius: px,
    borderBottomRightRadius: px,
    borderBottomLeftRadius: px,

    // Positioning props
    width: px,
    maxWidth: px,
    height: px,
    maxHeight: px,
    top: px,
    right: px,
    bottom: px,
    left: px,

    // Spacing props
    padding: px,
    paddingTop: px,
    paddingRight: px,
    paddingBottom: px,
    paddingLeft: px,
    margin: px,
    marginTop: px,
    marginRight: px,
    marginBottom: px,
    marginLeft: px,

    // Misc
    backgroundPositionX: px,
    backgroundPositionY: px,

    ...transformValueTypes,
    zIndex: int,

    // SVG
    fillOpacity: alpha,
    strokeOpacity: alpha,
    numOctaves: int,
}
