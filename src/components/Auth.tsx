import React, { useEffect, useState, useCallback } from 'react'
import { fetchQRSessionToken, pollQRLoginExchange } from '../auth'
import { QRCodeSVG } from 'qrcode.react'

function useAuth() {
  const [loaded, setLoaded] = useState(false)
  const [accessToken, setAccessToken] = useState(null)
  const [refreshToken, setRefreshToken] = useState(null)

  useEffect(() => {
    if (logseq.settings) {
      const accessToken = logseq.settings.matterAccessToken
      const refreshToken = logseq.settings.matterRefreshToken
      setAccessToken(accessToken)
      setRefreshToken(refreshToken)
      setLoaded(true)
    }
  }, [])

  const handleExchange = async (response: any) => {
    if (response.access_token && response.refresh_token) {
      setAccessToken(response.access_token)
      setRefreshToken(response.refresh_token)
      logseq.updateSettings({
        matterAccessToken: response.access_token,
        matterRefreshToken: response.refresh_token,
      })
    }
  }

  return {
    loaded,
    accessToken,
    refreshToken,
    handleExchange,
  }
}

export default function Auth() {
  const [sessionToken, setSessionToken] = useState(null)
  const { accessToken, refreshToken, loaded, handleExchange } = useAuth()
  const isAuthed = accessToken && refreshToken && loaded

  const setupQR = useCallback(async () => {
    const _sessionToken = await fetchQRSessionToken()
    setSessionToken(_sessionToken)
    const response = await pollQRLoginExchange(_sessionToken)
    handleExchange(response)
  }, [])

  useEffect(() => {
    if (!isAuthed && loaded) {
      setupQR()
    }
  }, [isAuthed, loaded, setupQR])

  if (isAuthed) {
    return (
      <div>
        <p>✅</p>
      </div>
    )
  }

  return (
    <div>{sessionToken && <QRCodeSVG value={sessionToken} size={115} />}</div>
  )
}
