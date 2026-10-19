import Campaigns from "@/components/team/Campaigns";
export const dynamic = "force-dynamic";
/** Campaigns — where Board Room plans run as tests (team-only via the /team layout). */
export default function CampaignsPage({ searchParams }: { searchParams: { id?: string } }) { return <Campaigns initialId={searchParams.id ?? null} />; }
