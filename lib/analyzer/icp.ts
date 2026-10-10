// ICP presets per detected business category. Visible config, not a guess at
// runtime: if the category isn't here, the outbound check says so instead of
// inventing an ideal customer.
export type IcpPreset = { label: string; queries: string[] };

const PRESETS: { match: RegExp; icp: IcpPreset }[] = [
  { match: /roof/i, icp: { label: "property managers, HOAs and general contractors", queries: ["property management company", "homeowners association management", "general contractor"] } },
  { match: /hvac|heating|air condition|plumb|electric/i, icp: { label: "property managers, builders and facility managers", queries: ["property management company", "home builder", "facility management"] } },
  { match: /dent|dental|orthodont/i, icp: { label: "employers and benefits brokers nearby", queries: ["employee benefits broker", "corporate office", "staffing agency"] } },
  { match: /med ?spa|aesthetic|dermatolog|clinic|chiro|physical therapy|wellness/i, icp: { label: "gyms, salons and corporate wellness partners", queries: ["fitness studio", "hair salon", "corporate wellness"] } },
  { match: /law|attorney|legal/i, icp: { label: "real estate brokers, CPAs and financial advisors", queries: ["real estate brokerage", "CPA firm", "financial advisor"] } },
  { match: /landscap|lawn|pool|pest|clean/i, icp: { label: "property managers, HOAs and commercial landlords", queries: ["property management company", "homeowners association", "commercial real estate owner"] } },
  { match: /real estate|realtor|mortgage/i, icp: { label: "relocation companies, builders and financial planners", queries: ["relocation services", "home builder", "financial planner"] } },
  { match: /restaurant|cater|food/i, icp: { label: "corporate offices, event planners and venues", queries: ["event planner", "corporate office", "wedding venue"] } },
  { match: /agency|marketing|consult|software|saas|it services/i, icp: { label: "local businesses with 10–200 staff", queries: ["home services company", "medical practice", "law firm"] } },
];

export function icpFor(category: string | null | undefined): IcpPreset | null {
  if (!category) return null;
  return PRESETS.find((p) => p.match.test(category))?.icp ?? null;
}
