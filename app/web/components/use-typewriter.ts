"use client"

import { useEffect, useState } from "react"

const TYPE_MS = 45
const ERASE_MS = 22
const HOLD_MS = 1600

/**
 * Cycles through phrases with a typewriter effect while `active`.
 * Honors prefers-reduced-motion by showing whole phrases without the letter-by-letter animation.
 */
export function useTypewriter(phrases: readonly string[], active: boolean): string {
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [erasing, setErasing] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const phrase = phrases[index % phrases.length] ?? ""

  useEffect(() => {
    if (!active) return
    if (reduced) {
      const timer = setTimeout(() => setIndex((i) => i + 1), HOLD_MS * 2)
      return () => clearTimeout(timer)
    }
    if (!erasing && length < phrase.length) {
      const timer = setTimeout(() => setLength((l) => l + 1), TYPE_MS)
      return () => clearTimeout(timer)
    }
    if (!erasing && length === phrase.length) {
      const timer = setTimeout(() => setErasing(true), HOLD_MS)
      return () => clearTimeout(timer)
    }
    if (erasing && length > 0) {
      const timer = setTimeout(() => setLength((l) => l - 1), ERASE_MS)
      return () => clearTimeout(timer)
    }
    setErasing(false)
    setIndex((i) => i + 1)
    return undefined
  }, [active, reduced, erasing, length, phrase])

  return reduced ? phrase : phrase.slice(0, length)
}
