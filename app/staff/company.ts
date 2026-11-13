// Per-company configuration. Sample data only: nothing here is a real record.
export const company = {
 "name": "SFBConnect",
 "pipelineTitle": "Agency pipeline",
 "stages": [
  "Agency lead",
  "Scope submitted",
  "Scope approved",
  "Paid",
  "Fulfillment",
  "Handed over"
 ],
 "hiringStages": null,
 "noun": "agency",
 "queue": [
  [
   "Northline Agency",
   "Scope submitted",
   "Review scope",
   "Reviewer",
   "Today",
   "\u2014",
   "Portal"
  ],
  [
   "Brightpath Co.",
   "Paid",
   "Assign fulfillment",
   "Manager",
   "Tomorrow",
   "Waiting on teammate",
   "Stripe"
  ],
  [
   "Kite Studio",
   "Agency lead",
   "Qualify",
   "Setter",
   "Fri",
   "\u2014",
   "Referral"
  ]
 ],
 "handoffs": [
  [
   "Brightpath Co.",
   "Reviewer",
   "Fulfillment",
   "Paid, assign team",
   "Pending"
  ]
 ],
 "customDesc": {
  "agencies": "Agency accounts and their client portals.",
  "scope-reviews": "Scopes waiting for approval. Approved scope leads to agreement and payment.",
  "fulfillment": "Paid work in progress, with handover.",
  "white-label": "Per-agency brand settings: name, logo, domain. Configuration only; permissions stay in shared code."
 },
 "steps": [
  [
   "check-in",
   "Check in & set your focus",
   "Pick today's agencies and scopes."
  ],
  [
   "my-work",
   "Review My Queue",
   "Due items, next actions and blockers."
  ],
  [
   "contacts",
   "Move agencies forward",
   "Update stage and hand off."
  ]
 ]
} as const;
