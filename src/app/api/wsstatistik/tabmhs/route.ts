import { NextResponse } from 'next/server';
import { buildExternalUrl } from '../utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id_smt = searchParams.get('id_smt') ?? undefined;
  const refresh = searchParams.get('refresh') ?? undefined;
  const url = buildExternalUrl('tabmhs', { id_smt, refresh });
  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch tabmhs data' }, { status: 502 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}
