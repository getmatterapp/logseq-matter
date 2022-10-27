import { CLIENT_TYPE, ENDPOINTS, QRLoginExchangeResponse } from './api'
import { sleep } from './utils'

export async function fetchQRSessionToken() {
  try {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    const triggerResponse = await fetch(ENDPOINTS.QR_LOGIN_TRIGGER, {
      method: 'POST',
      body: JSON.stringify({ client_type: CLIENT_TYPE }),
      headers,
    })
    return (await triggerResponse.json()).session_token
  } catch (error) {
    return null
  }
}

export async function pollQRLoginExchange(sessionToken: string) {
  let attempts = 0
  while (attempts < 600) {
    try {
      const loginSession = await qrLoginExchange(sessionToken)
      if (loginSession?.access_token) {
        return {
          access_token: loginSession.access_token,
          refresh_token: loginSession.refresh_token,
        }
      }
    } finally {
      attempts++
      await sleep(1000)
    }
  }
}

async function qrLoginExchange(
  sessionToken: string,
): Promise<QRLoginExchangeResponse> {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  const response = await fetch(ENDPOINTS.QR_LOGIN_EXCHANGE, {
    method: 'POST',
    body: JSON.stringify({
      session_token: sessionToken,
    }),
    headers,
  })
  return response.json()
}
