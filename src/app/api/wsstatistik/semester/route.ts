import { NextResponse } from "next/server";
import { fetchExternal } from "../utils";
import type { SemesterPayload } from "@/lib/monev-types";

export async function GET() {
  const data = await fetchExternal<SemesterPayload>("semester");
  if (!data) {
    return NextResponse.json(
      { error: "Failed to fetch semester data" },
      { status: 502 }
    );
  }
  return NextResponse.json(data);
}
