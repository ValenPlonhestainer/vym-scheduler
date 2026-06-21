import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url))
  response.cookies.delete('user_id')
  response.cookies.delete('congregation_id')
  return response
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('user_id')
  response.cookies.delete('congregation_id')
  return response
}
