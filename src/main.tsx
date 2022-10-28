import '@logseq/libs'

import React from 'react'
import * as ReactDOM from 'react-dom/client'
import App from './components/App'
import './index.css'

import { logseq as PL } from '../package.json'
import { intervalSyncMinutes } from './constants'
import { intervalSync } from './sync'

const openIconName = 'logseq-matter-open'

// @ts-expect-error
const css = (t, ...args) => String.raw(t, ...args)

function clearSettings() {
  logseq.updateSettings({
    graph: null,
    matterAccessToken: null,
    matterRefreshToken: null,
    matterIsSyncing: false,
    matterLastSync: null,
    matterSyncHeartbeat: null,
    matterSyncFrequence: 'Manual',
  })
}

function main() {
  const root = ReactDOM.createRoot(document.getElementById('app')!)
  logseq.useSettingsSchema([
    {
      key: 'matterSyncFrequency',
      type: 'enum',
      title: 'Sync Frequency',
      description: 'How often should Logseq sync with Matter?',
      default: 'Manual',
      enumPicker: 'select',
      enumChoices: [
        'Manual',
        'Every half hour',
        'Every hour',
        'Every 12 hours',
        'Every 24 hours',
      ],
    },
  ])

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  function createModel() {
    return {
      show() {
        logseq.showMainUI()
      },
    }
  }

  logseq.provideModel(createModel())
  logseq.setMainUIInlineStyle({
    zIndex: 11,
  })

  logseq.provideStyle(css`
    .${openIconName} {
      font-size: 20px;
      cursor: pointer;
    }
    .${openIconName}-light svg {
      background-color: #fffff;
    }
    .${openIconName}-light path {
      fill: #0d0d0d;
    }
    .${openIconName}-dark svg {
      background-color: transparent;
    }
    .${openIconName}-dark path {
      fill: #ffffff;
    }
  `)
  setToolbarIcon()

  let _settings = logseq.settings
  let runningInterval: NodeJS.Timer | null = null
  const startIntervalSync = () => {
    if (!logseq.settings?.matterAccessToken) {
      return
    }

    if (runningInterval) {
      clearInterval(runningInterval)
    }

    runningInterval = setInterval(intervalSync, 60 * intervalSyncMinutes * 1000)
    intervalSync()
  }

  if (!logseq.settings?.matterAccessToken) {
    logseq.UI.showMsg('Finish configuring Matter in settings', 'warn', {
      timeout: 5000,
    })
  } else {
    startIntervalSync()
  }

  logseq.addListener('settings:changed', () => {
    if (
      logseq.settings!.matterAccessToken !== _settings!.matterAccessToken ||
      logseq.settings!.matterSyncFrequency !== _settings!.matterSyncFrequency
    ) {
      startIntervalSync()
    }
    _settings = logseq.settings
  })

  logseq.App.onThemeModeChanged(() => {
    setToolbarIcon()
  })

  logseq.beforeunload(async () => {
    if (runningInterval) {
      clearInterval(runningInterval)
    }
    logseq.removeAllListeners()
  })
}

const setToolbarIcon = async () => {
  const mode = (await logseq.App.getUserConfigs()).preferredThemeMode

  logseq.App.registerUIItem('toolbar', {
    key: openIconName,
    template: `
        <div data-on-click="show" class="${openIconName} ${openIconName}-${mode}">
          <svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path fill="#0D0D0D" fill-rule="evenodd" clip-rule="evenodd" d="M37.5 0C16.7893 0 0 16.7893 0 37.5V62.5C0 83.2107 16.7893 100 37.5 100H62.5C83.2107 100 100 83.2107 100 62.5V37.5C100 16.7893 83.2107 0 62.5 0H37.5ZM41.6881 33.125C41.6881 34.3697 41.2839 35.5199 40.5995 36.4516L48.4495 47.4416C48.9789 47.2766 49.5419 47.1877 50.1256 47.1877C50.7092 47.1877 51.272 47.2765 51.8012 47.4415L59.6514 36.4512C58.9672 35.5196 58.5631 34.3695 58.5631 33.125C58.5631 30.0184 61.0815 27.5 64.1881 27.5C67.2947 27.5 69.8131 30.0184 69.8131 33.125C69.8131 35.1281 68.7661 36.8867 67.1894 37.8833L73.0348 61.2648C75.95 61.4748 78.2497 63.9064 78.2497 66.8751C78.2497 69.9817 75.7313 72.5001 72.6247 72.5001C69.5181 72.5001 66.9997 69.9817 66.9997 66.8751C66.9997 64.8717 68.047 63.113 69.6239 62.1165L63.7786 38.7353C63.3404 38.7038 62.916 38.6221 62.5113 38.4958L54.6616 49.4855C55.3462 50.4173 55.7506 51.5677 55.7506 52.8127C55.7506 55.9193 53.2322 58.4377 50.1256 58.4377C47.019 58.4377 44.5006 55.9193 44.5006 52.8127C44.5006 51.5679 44.9049 50.4176 45.5894 49.4859L37.7394 38.496C37.3347 38.6222 36.9103 38.7039 36.472 38.7354L30.6266 62.117C32.2031 63.1136 33.25 64.8721 33.25 66.8751C33.25 69.9817 30.7316 72.5001 27.625 72.5001C24.5184 72.5001 22 69.9817 22 66.8751C22 63.9061 24.3003 61.4743 27.2158 61.2647L33.0613 37.8829C31.4849 36.8863 30.4381 35.1279 30.4381 33.125C30.4381 30.0184 32.9565 27.5 36.0631 27.5C39.1697 27.5 41.6881 30.0184 41.6881 33.125Z" />
          </svg>
        </div>
      `,
  })
}

logseq.ready(main).catch(console.error)
