import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const externalUrl = 'http://kuesioner.universitaspahlawan.ac.id/wsstatistik/semester';
  const response = await fetch(externalUrl);
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch semester data' }, { status: 502 });
  }
  const data = await response.json();
  return NextResponse.json(data);
}
