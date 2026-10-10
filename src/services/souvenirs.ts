import { SupabaseClient } from '@supabase/supabase-js'
import * as Location from 'expo-location'

export type Gift =
  | { kind: 'text'; textType: 'poem' | 'essay'; body: string }
  | { kind: 'link'; url: string }
  | { kind: 'image' | 'file'; uri: string; name: string; mimeType?: string | null }

export type SubmitSouvenirParams = {
  objectImageUri: string
  teaser: string
  clue: string
  gift: Gift
  claimLimit: number
}

async function uploadFileToSupabase(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  uri: string,
  contentType: string
) {
  const cleanPath = path.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const response = await fetch(uri)
  const blob = await response.blob()

  const reader = new FileReader()
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const res = reader.result as string
      const base64 = res.split(',')[1] ?? res
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

  const base64 = await base64Promise
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const { error } = await supabase.storage.from(bucket).upload(cleanPath, bytes, {
    contentType,
    upsert: true,
  })

  if (error) {
    console.error(`Supabase storage upload error [bucket=${bucket}, path=${cleanPath}]:`, error)
    throw error
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath)
  return data.publicUrl
}

export async function submitSouvenir(
  supabase: SupabaseClient,
  userId: string,
  username: string | null | undefined,
  params: SubmitSouvenirParams
) {
  // 1. Get current location
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  })

  const { latitude, longitude } = location.coords

  // 2. Upload object photo
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const objectPath = `${safeUserId}_${Date.now()}.jpg`
  const objectImageUrl = await uploadFileToSupabase(
    supabase,
    'object-photos',
    objectPath,
    params.objectImageUri,
    'image/jpeg'
  )

  // 3. Process gift payload/upload
  let giftData: any = { ...params.gift }

  if (params.gift.kind === 'image' || params.gift.kind === 'file') {
    const rawExt = params.gift.name.split('.').pop() ?? 'bin'
    const safeExt = rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'bin'
    const giftPath = `gifts_${safeUserId}_${Date.now()}.${safeExt}`
    const uploadedGiftUrl = await uploadFileToSupabase(
      supabase,
      'souvenir-art',
      giftPath,
      params.gift.uri,
      params.gift.mimeType ?? 'application/octet-stream'
    )
    giftData = {
      kind: params.gift.kind,
      name: params.gift.name,
      url: uploadedGiftUrl,
    }
  }

  // 4. Insert souvenir record into Supabase
  const { data, error } = await supabase.from('souvenirs').insert({
    creator_id: userId,
    creator_username: username ?? 'Anonymous',
    latitude,
    longitude,
    object_image_url: objectImageUrl,
    teaser: params.teaser,
    clue: params.clue,
    gift: giftData,
    claim_limit: params.claimLimit,
    claims_count: 0,
  }).select().single()

  if (error) throw error
  return data
}
