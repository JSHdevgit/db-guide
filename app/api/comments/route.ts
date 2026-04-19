import { NextRequest } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/password'
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

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return Response.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 })
  }

  const chapterSlug = req.nextUrl.searchParams.get('chapterSlug')
  if (!chapterSlug) {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('comments')
    .select('id, chapter_slug, parent_id, nickname, body, created_at, updated_at, edited')
    .eq('chapter_slug', chapterSlug)
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ comments: data })
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return Response.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 })
  }

  if (!checkOrigin(req)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const { chapterSlug, parentId, nickname, body: commentBody, password } = body as Record<string, string>

  if (
    typeof chapterSlug !== 'string' || !chapterSlug ||
    typeof nickname !== 'string' || nickname.length < 1 || nickname.length > 40 ||
    typeof commentBody !== 'string' || commentBody.length < 1 || commentBody.length > 2000 ||
    typeof password !== 'string' || !password
  ) {
    return Response.json({ error: 'VALIDATION' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  if (parentId) {
    const { data: parent } = await db
      .from('comments')
      .select('id')
      .eq('id', parentId)
      .single()

    if (!parent) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
  }

  const passwordHash = await hashPassword(password)

  const { data, error } = await db
    .from('comments')
    .insert({
      chapter_slug: chapterSlug,
      parent_id: parentId ?? null,
      nickname,
      body: commentBody,
      password_hash: passwordHash,
    })
    .select('id, chapter_slug, parent_id, nickname, body, created_at, updated_at, edited')
    .single()

  if (error) {
    return Response.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return Response.json({ comment: data }, { status: 201 })
}
