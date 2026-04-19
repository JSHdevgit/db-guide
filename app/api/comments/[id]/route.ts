import { NextRequest } from 'next/server'
import { verifyPassword } from '@/lib/password'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'


function isConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function checkOrigin(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isConfigured()) {
    return Response.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 })
  }

  if (!checkOrigin(req)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const { password, body: newBody, nickname: newNickname } = body as Record<string, string>

  if (typeof password !== 'string' || !password) {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }
  if (newBody !== undefined && (typeof newBody !== 'string' || newBody.length < 1 || newBody.length > 2000)) {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }
  if (newNickname !== undefined && (typeof newNickname !== 'string' || newNickname.length < 1 || newNickname.length > 40)) {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  const { data: existing } = await db
    .from('comments')
    .select('id, password_hash')
    .eq('id', id)
    .single()

  if (!existing) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const valid = await verifyPassword(password, existing.password_hash)
  if (!valid) {
    return Response.json({ error: 'INVALID_PASSWORD' }, { status: 401 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), edited: true }
  if (newBody) updates.body = newBody
  if (newNickname) updates.nickname = newNickname

  const { data, error } = await db
    .from('comments')
    .update(updates)
    .eq('id', id)
    .select('id, chapter_slug, parent_id, nickname, body, created_at, updated_at, edited')
    .single()

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ comment: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isConfigured()) {
    return Response.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 })
  }

  if (!checkOrigin(req)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const { password } = body as Record<string, string>

  if (typeof password !== 'string' || !password) {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  const { data: existing } = await db
    .from('comments')
    .select('id, password_hash')
    .eq('id', id)
    .single()

  if (!existing) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const valid = await verifyPassword(password, existing.password_hash)
  if (!valid) {
    return Response.json({ error: 'INVALID_PASSWORD' }, { status: 401 })
  }

  const { error } = await db.from('comments').delete().eq('id', id)

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
