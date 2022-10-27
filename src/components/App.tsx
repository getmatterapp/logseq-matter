import React, { useRef } from 'react'
import { useAppVisible } from '../utils'
import Settings from './Settings'

function App() {
  const innerRef = useRef<HTMLDivElement>(null)
  const visible = useAppVisible()
  if (visible) {
    return (
      <main
        className="backdrop-filter backdrop-blur-md fixed inset-0 flex items-center justify-center"
        onClick={(e) => {
          if (!innerRef.current?.contains(e.target as any)) {
            window.logseq.hideMainUI()
          }
        }}
      >
        <div
          ref={innerRef}
          className="flex justify-center w-full text-size-2em"
        >
          <Settings />
        </div>
      </main>
    )
  }
  return null
}

export default App
