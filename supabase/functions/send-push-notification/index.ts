// In supabase/functions/send-push-notification/index.ts
// Replace the existing file entirely:

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface NotificationRecord {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: NotificationRecord
  schema: string
}

function getDeepLinkUrl(notification: NotificationRecord): string {
  const { type, data } = notification

  switch (type) {
    case 'new_message':
    case 'rating_request':
    case 'rating_confirmed':
      if (data.conversation_id) {
        return `babyly://conversation/${data.conversation_id}`
      }
      if (type === 'rating_request' && data.listing_id) {
        return `babyly://(tabs)/chat`
      }
      if (type === 'rating_confirmed' && data.buyer_id) {
        return `babyly://profile/${data.buyer_id}`
      }
      return `babyly://(tabs)/chat`

    case 'listing_favorited':
    case 'listing_status_changed':
      if (data.listing_id) {
        const suffix = data.listing_type === 'buy_nothing'
          ? '?type=buy_nothing'
          : ''
        return `babyly://listing/${data.listing_id}${suffix}`
      }
      return `babyly://(tabs)/shop`

    default:
      return `babyly://(tabs)/chat`
  }
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()
    const notification = payload.record

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', notification.user_id)
      .single()

    if (userError || !userData?.push_token) {
      console.log('No push token for user:', notification.user_id)
      return new Response(
        JSON.stringify({ message: 'No push token found' }),
        { status: 200 }
      )
    }

    const pushToken = userData.push_token

    if (!pushToken.startsWith('ExponentPushToken[')) {
      console.log('Invalid push token format:', pushToken)
      return new Response(
        JSON.stringify({ message: 'Invalid push token' }),
        { status: 200 }
      )
    }

    const deepLinkUrl = getDeepLinkUrl(notification)
    console.log('Deep link URL:', deepLinkUrl)

    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: pushToken,
        title: notification.title,
        body: notification.body,
        data: {
          ...notification.data,
          type: notification.type,
          url: deepLinkUrl,
          notification_id: notification.id,
        },
        sound: 'default',
        badge: 1,
        channelId: 'default',
      }),
    })

    const expoResult = await expoResponse.json()
    console.log('Expo push result:', JSON.stringify(expoResult))

    return new Response(
      JSON.stringify({ success: true, result: expoResult }),
      { status: 200 }
    )

  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    )
  }
})