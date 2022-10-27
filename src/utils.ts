import { LSPluginUserEvents } from '@logseq/libs/dist/LSPlugin.user'
import React from 'react'

let _visible = logseq.isMainUIVisible

function subscribeLogseqEvent<T extends LSPluginUserEvents>(
  eventName: T,
  handler: (...args: any) => void,
) {
  logseq.on(eventName, handler)
  return () => {
    logseq.off(eventName, handler)
  }
}

const subscribeToUIVisible = (onChange: () => void) =>
  subscribeLogseqEvent('ui:visible:changed', ({ visible }) => {
    _visible = visible
    onChange()
  })

export const useAppVisible = () => {
  return React.useSyncExternalStore(subscribeToUIVisible, () => _visible)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function randomInt(range: number) {
  const sign = Math.round(Math.random()) * 2 - 1
  const abs = Math.floor(Math.random() * range)
  return sign * abs
}

export function diffInMinutes(a: Date, b: Date): number {
  const diffMs = (a as any) - (b as any)
  const diffS = diffMs / 1000
  return diffS / 60
}
