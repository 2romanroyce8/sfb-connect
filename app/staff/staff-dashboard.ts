export const staffTabs=[
 {key:"dashboard",label:"Home",group:"Daily workspace"},
 {key:"start-here",label:"Start Here",group:"Daily workspace"},
 {key:"my-work",label:"My Queue",group:"Daily workspace"},
 {key:"assignments",label:"Handoffs",group:"Daily workspace"},
 {key:"calendar",label:"Calendar",group:"Daily workspace"},
 {key:"announcements",label:"Announcements",group:"Daily workspace"},
 {key:"check-in",label:"Daily Check-in",group:"Daily workspace"},
 {key:"contacts",label:"Pipeline",group:"Client work"},
 {key:"agencies",label:"Agencies",group:"Client work"},
 {key:"scope-reviews",label:"Scope Reviews",group:"Client work"},
 {key:"fulfillment",label:"Fulfillment",group:"Client work"},
 {key:"white-label",label:"White-label",group:"Resources & team"},
 {key:"notes",label:"Notes",group:"Client work"},
 {key:"analytics",label:"Analytics",group:"Client work"},
 {key:"files",label:"Files",group:"Resources & team"},
 {key:"team-chat",label:"Team Chat",group:"Resources & team"},
 {key:"team-operations",label:"Team Operations",group:"Resources & team"},
 {key:"team-members",label:"Team Members",group:"Resources & team"},
 {key:"settings",label:"Settings",group:"Resources & team"},
] as const;
export type StaffTabId=typeof staffTabs[number]['key'];
export function canOpenExecutiveDashboard(role:string){return role==='owner'||role==='manager'}


export function visibleStaffTabs(role: string) {
  return staffTabs.filter(tab => tab.key !== 'team-operations' || canOpenExecutiveDashboard(role));
}
