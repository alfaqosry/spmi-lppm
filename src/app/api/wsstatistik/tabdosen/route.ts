import { NextResponse } from 'next/server';
import { buildExternalUrl } from '../utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id_smt = searchParams.get('id_smt') ?? undefined;
  const id_sms = searchParams.get('id_sms') ?? undefined;
  const refresh = searchParams.get('refresh') ?? undefined;
  const url = buildExternalUrl('tabdosen', { id_smt, id_sms, refresh });
  const response = await fetch(url);
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch tabdosen data' }, { status: 502 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}
