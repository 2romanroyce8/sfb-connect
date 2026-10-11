import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which commit is actually serving production. Vercel injects the git SHA at
 * build time; this is the "green gate" for every verification: a test only
 * counts if this SHA equals the commit that was tested. Public, no secrets.
 */
export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    env: process.env.VERCEL_ENV ?? null,
    deployedAt: process.env.VERCEL_DEPLOYMENT_CREATED_AT ?? null,
  }, { headers: { "cache-control": "no-store" } });
}
