import { NextResponse } from "next/server";
import { vcard } from "@/lib/demoCall/booking";
export const dynamic = "force-static";

/** "Save 213-523-1641 as SFB CONNECT" — a vCard any phone opens straight into Contacts. */
export async function GET() {
  return new NextResponse(vcard(), { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": 'attachment; filename="SFB-CONNECT.vcf"', "Cache-Control": "public, max-age=86400" } });
}
