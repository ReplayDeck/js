declare const __REPLAYDECK_VERSION__: string

export const SDK = "replaydeck-js"
export const VERSION = typeof __REPLAYDECK_VERSION__ === "string" ? __REPLAYDECK_VERSION__ : "0.0.0"
