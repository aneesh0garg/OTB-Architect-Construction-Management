import { NextRequest } from 'next/server';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = new URL(`${apiBaseUrl}/${path.join('/')}`);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const response = await fetch(target, {
    method: request.method,
    headers,
    ...(body ? { body } : {}),
    redirect: 'manual',
  });
  return new Response(response.body, { status: response.status, headers: response.headers });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
