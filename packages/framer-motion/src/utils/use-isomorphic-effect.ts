"use client"

import { useEffect, useLayoutEffect } from "react"
import { isBrowser } from "./is-browser"

export const useIsomorphicLayoutEffect = isBrowser ? useLayoutEffect : useEffect
