import React, { useEffect, useState } from 'react'
import { sync } from '../sync'
import Auth from './Auth'

export default function Settings() {
  const [settings, setSettings] = useState<{ [key: string]: any } | undefined>(
    {},
  )
  const [currentGraph, setCurrentGraph] = useState<{
    [key: string]: any
  } | null>({})

  const updateSettings = () => {
    setSettings({ ...logseq.settings })
  }

  const updateCurrentGraph = async () => {
    setCurrentGraph(await logseq.App.getCurrentGraph())
  }

  useEffect(() => {
    updateSettings()
    logseq.addListener('settings:changed', updateSettings)
    return () => {
      logseq.removeListener('settings:changed', updateSettings)
    }
  }, [])

  useEffect(() => {
    updateCurrentGraph()
    logseq.App.onCurrentGraphChanged(updateCurrentGraph)
  }, [])

  const onRelevantGraph =
    !logseq.settings?.graph || currentGraph?.url === logseq.settings.graph.url
  return (
    <div className="bg-white rounded border filter-none w-full max-w-2xl shadow-lg">
      <h1 className="text-xl p-4">Matter Settings</h1>
      <hr />
      {onRelevantGraph ? (
        <>
          <div className="flex flex-row border-b p-4 items-center justify-between">
            <div className="flex flex-col">
              <p>Authentication</p>
              <p className="text-xs text-gray-600">
                Go to Settings &gt; Connected Accounts &gt; Logseq and scan the
                QR code to log in
              </p>
            </div>
            <Auth />
          </div>
          <div className="flex flex-row border-b p-4 items-center justify-between">
            <div className="flex flex-col">
              <p>Sync Frequency</p>
              <p className="text-xs text-gray-600">
                How often should Logseq sync with Matter?
              </p>
            </div>
            <select
              className="border rounded cursor-pointer p-2"
              value={settings!.matterSyncFrequency}
              onChange={(e) =>
                logseq.updateSettings({
                  matterSyncFrequency: e.target.value,
                })
              }
            >
              <option value="Manual">Manual</option>
              <option value="Every half hour">Every half hour</option>
              <option value="Every hour">Every hour</option>
              <option value="Every 12 hours">Every 12 hours</option>
              <option value="Every 24 hours">Every 24 hours</option>
            </select>
          </div>
          <div className="flex flex-row p-4 items-center justify-between">
            <div className="flex flex-col">
              <p>Sync Now</p>
              <p className="text-xs text-gray-600">
                Manually start a sync with Matter
              </p>
            </div>
            <button
              className={`border px-3 py-2 rounded ${
                settings?.matterIsSyncing ? 'bg-gray-100 text-gray-400' : ''
              }`}
              disabled={settings?.matterIsSyncing}
              onClick={() => {
                if (!settings?.matterIsSyncing) {
                  sync()
                }
              }}
            >
              {settings?.matterIsSyncing ? <>Syncing...</> : <>Sync Now</>}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-row border-b p-4 items-center justify-center">
          <p>
            Open{' '}
            <span className="font-bold">{logseq.settings?.graph.name}</span> to
            sync with Matter
          </p>
        </div>
      )}
    </div>
  )
}
