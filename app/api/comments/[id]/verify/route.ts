import { NextRequest } from 'next/server'
import { verifyPassword } from '@/lib/password'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: existing } = await getSupabaseAdmin()
    .from('comments')
    .select('password_hash')
    .eq('id', id)
    .single()

  if (!existing) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const valid = await verifyPassword(password, existing.password_hash)
  if (!valid) {
    return Response.json({ error: 'INVALID_PASSWORD' }, { status: 401 })
  }

  return Response.json({ ok: true })
}
