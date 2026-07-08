import { NextResponse } from "next/server";
import { getWorkerStatus } from "@/lib/health/heartbeat";

/** Worker liveness for the dashboard status light. Always 200 (status is in the body). */
export async function GET() {
  const status = await getWorkerStatus();
  return NextResponse.json(status);
}
