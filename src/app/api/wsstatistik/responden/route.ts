import { NextResponse } from 'next/server';

const BASE = 'https://kuesioner.universitaspahlawan.ac.id/ws/getresponden';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idptk = searchParams.get('idptk');

  if (!idptk) {
    return NextResponse.json({ error: 'Parameter idptk wajib diisi' }, { status: 400 });
  }

  try {
    const url = `${BASE}?idptk=${encodeURIComponent(idptk)}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Gagal mengambil detail responden dosen' },
        { status: 502 },
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Gagal menghubungi layanan kuesioner' },
      { status: 502 },
    );
  }
}
