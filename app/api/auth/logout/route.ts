import { NextResponse } from 'next/server'

const SESSION_COOKIES = ['user_id', 'congregation_id', 'user_role', 'sb_access_token', 'sb_refresh_token']

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url))
  for (const c of SESSION_COOKIES) response.cookies.delete(c)
  return response
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  for (const c of SESSION_COOKIES) response.cookies.delete(c)
  return response
}
