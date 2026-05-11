import { NextResponse } from "next/server"
import { recordLastLogin } from "@/lib/actions/auth"

export async function POST() {
  const result = await recordLastLogin()
  return NextResponse.json(result)
}
