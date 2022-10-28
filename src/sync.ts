import { BlockEntity, PageEntity } from '@logseq/libs/dist/LSPlugin.user'
import {
  Annotation,
  authedRequest,
  ENDPOINTS,
  FeedEntry,
  FeedResponse,
  Tag,
} from './api'
import {
  syncJitterRange,
  syncStaleMinutes,
  syncFrequencies,
  syncCooldownMinutes,
  maxNumWrites,
} from './constants'
import { diffInMinutes, randomInt } from './utils'
import { format } from 'date-fns'

export const intervalSync = () => {
  const syncJitter = randomInt(syncJitterRange)

  // If a sync has been abandoned, restart the process
  if (isSyncStale(syncJitter) && logseq.settings!.matterIsSyncing) {
    sync()
    return
  }

  const now = new Date()
  const lastSync = getLastSync()
  const syncFrequencyKey = logseq.settings!.matterSyncFrequency

  let syncFrequency = syncFrequencies[syncFrequencyKey]
  if (syncFrequency < 0) {
    return
  }
  syncFrequency += syncJitter

  let should = false
  if (lastSync) {
    if (syncFrequency > 0 && diffInMinutes(now, lastSync) >= syncFrequency) {
      should = true
    }
  } else {
    should = true
  }

  // If a sync hasn't happened in some time, start a new one
  if (should && !logseq.settings!.matterIsSyncing) {
    sync()
  }
}

export const sync = async () => {
  // The graph used on first sync should be the graph targeted for every
  // subsequent sync
  const currentGraph = await logseq.App.getCurrentGraph()
  if (!logseq.settings?.graph) {
    logseq.updateSettings({
      graph: currentGraph,
    })
  } else if (logseq.settings.graph.url !== currentGraph!.url) {
    return
  }

  logseq.UI.showMsg('Syncing with Matter...', 'success', {
    timeout: 3000,
  })
  syncHeartbeat()
  setIsSyncing(true)

  try {
    const complete = await pageAnnotations()
    setLastSync(new Date())
    if (complete) {
      setIsSyncing(false)
      logseq.UI.showMsg('Finished syncing with Matter', 'success', {
        timeout: 3000,
      })
    } else {
      setTimeout(sync, 60 * syncCooldownMinutes * 1000)
    }
  } catch (error) {
    console.error(error)
  }
}

const pageAnnotations = async (): Promise<boolean> => {
  let url: string | null = ENDPOINTS.HIGHLIGHTS_FEED
  let feedEntries: FeedEntry[] = []

  // Load all feed items new to old.
  while (url !== null) {
    syncHeartbeat()
    const response: FeedResponse = await _authedRequest(url)
    feedEntries = feedEntries.concat(response.feed)
    url = response.next
  }

  // Reverse the feed items so that chronological ordering is preserved.
  feedEntries = feedEntries.reverse()

  let writeCount = 0
  for (const feedEntry of feedEntries) {
    const written = await handleFeedEntry(feedEntry)

    if (written) {
      writeCount += 1
    }

    if (writeCount >= maxNumWrites) {
      return false
    }
  }

  return true
}

const handleFeedEntry = async (feedEntry: FeedEntry): Promise<boolean> => {
  const pageTitle = feedEntry.content.title.trim()
  const page = await logseq.Editor.getPage(pageTitle)
  if (page) {
    const lastSync = getLastSync()
    let annotations = feedEntry.content.my_annotations

    if (lastSync) {
      annotations = annotations.filter(
        (a) => new Date(a.created_date) > lastSync,
      )
    }

    const pageTree = await logseq.Editor.getPageBlocksTree(page.name)
    annotations = annotations.filter(
      (a) => !annotationAppearsInPage(a, pageTree),
    )

    if (annotations.length) {
      await appendAnnotationsToPage(page, annotations)
      return true
    }

    return false
  } else {
    const page = await logseq.Editor.createPage(
      pageTitle,
      {},
      { redirect: false, createFirstBlock: false },
    )
    if (page) {
      await renderPage(page, feedEntry)
      return true
    }
    return false
  }
}

const renderPage = async (page: PageEntity, feedEntry: FeedEntry) => {
  const meta: string[] = [
    `source:: [${feedEntry.content.title}](${feedEntry.content.url})`,
  ]

  if (feedEntry.content.author) {
    if (feedEntry.content.author.any_name) {
      meta.push(`author:: [[${feedEntry.content.author.any_name}]]`)
    } else if (feedEntry.content.author.domain) {
      meta.push(`author:: [[${feedEntry.content.author.domain}]]`)
    }
  }

  if (feedEntry.content.publisher) {
    if (feedEntry.content.publisher.any_name) {
      meta.push(`publisher:: [[${feedEntry.content.publisher.any_name}]]`)
    } else {
      meta.push(`publisher:: [[${feedEntry.content.publisher.domain}]]`)
    }
  }

  if (feedEntry.content.tags) {
    meta.push(`tags:: ${renderTags(feedEntry.content.tags)}`)
  }

  if (feedEntry.content.my_note && feedEntry.content.my_note.note) {
    meta.push(`note:: ${feedEntry.content.my_note.note}`)
  }

  await logseq.Editor.appendBlockInPage(page.uuid, meta.join('\n'))
  await appendAnnotationsToPage(page, feedEntry.content.my_annotations)
}

const appendAnnotationsToPage = async (
  page: PageEntity,
  annotations: Annotation[],
) => {
  if (!annotations.length) {
    return
  }
  console.log('appendAnnotationsToPage', annotations)
  annotations = annotations.sort((a, b) => a.word_start - b.word_start)
  const userConfig = await logseq.App.getUserConfigs()
  const todayStr = format(new Date(), userConfig.preferredDateFormat)

  let highlightsHeader: string
  if (userConfig.enabledJournals) {
    highlightsHeader = `#### [[Highlights]] synced from [[Matter]] on [[${todayStr}]]`
  } else {
    highlightsHeader = `#### [[Highlights]] synced from [[Matter]] on [[${todayStr}]]`
  }

  let highlightsSection: BlockEntity | null | undefined = (
    await logseq.Editor.getPageBlocksTree(page.name)
  ).find((block) => block.content === highlightsHeader)

  if (!highlightsSection) {
    highlightsSection = await logseq.Editor.appendBlockInPage(
      page.uuid,
      highlightsHeader,
    )
  }

  for (const annotation of annotations) {
    const properties: { [key: string]: string } = {}
    if (annotation.note) {
      properties.note = annotation.note
    }

    await logseq.Editor.appendBlockInPage(
      highlightsSection?.uuid || page.uuid,
      annotation.text,
      {
        properties,
      },
    )
  }
}

const annotationAppearsInPage = (
  annotation: Annotation,
  pageTree: BlockEntity[],
): boolean => {
  while (pageTree.length) {
    const block = pageTree.pop()

    if (block?.content === annotation.text) {
      return true
    }

    if (block && block.children) {
      pageTree = pageTree.concat(block.children as BlockEntity[])
    }
  }

  return false
}

const renderTags = (tags: Tag[]): string => {
  const tagStrs = tags.map((tag) => {
    return `#[[${tag.name}]]`
  })

  if (tagStrs.length) {
    return ` ${tagStrs.join(' ')}`
  }

  return ''
}

const _authedRequest = async (url: string) => {
  const accessToken = logseq.settings!.matterAccessToken
  try {
    return await authedRequest(accessToken, url)
  } catch (e) {
    await refreshTokenExchange()
    return await authedRequest(accessToken, url)
  }
}

const refreshTokenExchange = async () => {
  const refreshToken = logseq.settings!.matterRefreshToken

  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  const response = await fetch(ENDPOINTS.REFRESH_TOKEN_EXCHANGE, {
    method: 'POST',
    headers,
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const payload = await response.json()
  logseq.updateSettings({
    matterAccessToken: payload.access_token,
    matterRefreshToken: payload.refresh_token,
  })
}

const setIsSyncing = (val: boolean) => {
  logseq.updateSettings({
    matterIsSyncing: val,
  })
}

const setLastSync = (val: Date) => {
  logseq.updateSettings({
    matterLastSync: val.toISOString(),
  })
}

const syncHeartbeat = () => {
  logseq.updateSettings({
    matterSyncHeartbeat: new Date().toISOString(),
  })
}

const isSyncStale = (syncJitter: number) => {
  const lastHeartbeat = logseq.settings!.matterSyncHeartbeat
  if (lastHeartbeat) {
    return (
      diffInMinutes(new Date(), new Date(lastHeartbeat)) >
      syncStaleMinutes + syncJitter
    )
  }
  return true
}

const getLastSync = (): Date | null => {
  const timestamp = logseq.settings!.matterLastSync
  if (timestamp) {
    return new Date(timestamp)
  }
  return null
}
