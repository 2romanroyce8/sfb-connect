"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined, ChevronRight, ClipboardCheck, Folder, Grid2X2, LayoutDashboard, ListTodo, LogOut, MapPin, Megaphone, Menu, MessageCircle, Mic, Moon, NotebookPen, PhoneCall, Plus, Search, Settings2, ShieldCheck, Sun, Target, Trophy, Users, Wrench, X } from "lucide-react";
import { visibleStaffTabs, type StaffTabId } from "./staff-dashboard";
import { Brand } from "./OrbMark";
import { AccountMenu } from "./AccountMenu";
import { branding } from "./branding";
import type { SessionUser } from "./types";
import { CompanyView } from "./CompanyView";
import { company } from "./company";

const user: SessionUser = { id: "sample", name: "Sample User", email: "sample@example.invalid", role: "owner", assignedBusinessIds: [] };
const staffIcons={'start-here':ClipboardCheck,'my-work':ListTodo,'member-success':Users,'team-operations':ShieldCheck,dashboard:LayoutDashboard,leaderboard:Trophy,'battle-pass':ShieldCheck,announcements:Megaphone,'check-in':ClipboardCheck,objective:Target,assignments:ListTodo,calendar:CalendarDays,notes:NotebookPen,contacts:Users,'dialed-in':PhoneCall,research:Search,analytics:ChartNoAxesCombined,tools:Wrench,files:Folder,apps:Grid2X2,'team-chat':MessageCircle,'team-members':Users,map:MapPin,settings:Settings2};
const views = visibleStaffTabs(user.role).map(tab => ({ ...tab, icon: (staffIcons as Record<string, typeof LayoutDashboard>)[tab.key] ?? LayoutDashboard }));

export default function StaffPage() {
  const [view, setView] = useState<StaffTabId>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [appearance, setAppearance] = useState<"dark" | "light">("dark");
  useEffect(() => {
    if (localStorage.getItem("sfb-dashboard-appearance") === "light") setAppearance("light");
  }, []);

  function toggleAppearance() {
    const next = appearance === "dark" ? "light" : "dark";
    setAppearance(next);
    localStorage.setItem("sfb-dashboard-appearance", next);
  }

  function onNavigate(next: StaffTabId) {
    setView(next);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }

  const title = views.find(item => item.key === view)?.label;
  return (
    <div className={`shell ${menuOpen ? "shell--menu-open" : ""}`} data-appearance={appearance}>
      <a className="skip-link" href="#team-main">Skip to main content</a>
      <aside className="sidebar">
        <Brand variant="staff" />
        <div className="workspace-badge"><span className="workspace-badge-icon">{branding.company[0]}</span><div><b>{branding.company}</b><small>Selected workspace</small></div><ChevronRight size={15} /></div>
        <p className="nav-label" id="team-nav-label">WORKSPACE</p>
        <nav className="nav" aria-labelledby="team-nav-label">
          {views.map(({key,label,icon:Icon}) => <button type="button" className="nav-link" key={key} aria-current={view === key ? "page" : undefined} onClick={() => onNavigate(key)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{view === key && <span className="nav-active-dot" />}</button>)}
        </nav>
        <div className="sidebar-foot">
          <div className="scope-card"><span className="scope-dot" /><div><b>1 business</b><small>Sample workspace</small></div></div>
          <div className="sidebar-profile"><span className="avatar">SU</span><div><b>{user.name}</b><small>{user.role}</small></div><button className="icon-button" type="button" aria-label="Sign out" disabled><LogOut size={18} /></button></div>
        </div>
      </aside>
      {menuOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><b>{title}</b></div>
          <div className="topbar-account">
            <button className="icon-button appearance-toggle" aria-label={appearance === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleAppearance}>{appearance === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="account-menu"><button className="icon-button" aria-label="Notifications" aria-expanded={notifications} onClick={() => setNotifications(!notifications)}><Bell size={18} /></button>{notifications && <div className="account-popover"><div className="account-popover-profile">No notifications yet.</div></div>}</div>
            <span className="role-chip">{user.role}</span>
            <AccountMenu allowAdministration={false} user={user} businesses={[{ id: "sample", name: branding.company }]} workspaceId="sample" onWorkspace={() => onNavigate("dashboard")} onAction={() => onNavigate("settings")} onLogout={() => onNavigate("dashboard")} />
          </div>
        </header>
        <main className="content" id="team-main" tabIndex={-1}>
          {view === "dashboard" ? (
<div className="staff-home-clean"><header className="staff-home-heading"><div><span className="eyebrow">YOUR DAILY WORKFLOW</span><h1>Make today count.</h1><p>{company.name}: set your focus, review your queue, and hand off with a named receiver.</p></div><button className="btn" onClick={()=>onNavigate('start-here')}>Start Here <ArrowUpRight size={16}/></button></header><section className="sop-start" aria-labelledby="sop-title"><header><h2 id="sop-title">Your daily routine</h2><span>Follow these steps in order</span></header><div className="sop-steps">{company.steps.map(([view,title,body],i)=><button key={view} onClick={()=>onNavigate(view as StaffTabId)}><span className="sop-number">0{i+1}</span><b>{title}</b><small>{body}</small><ArrowUpRight size={16}/></button>)}</div></section>
            <section className="home-assistant">
              <header><h2>Workspace assistant</h2><p>Ask a question or plan your next step.</p></header>
              <section className="voice-command-center" aria-label="Workspace assistant">
                <div className="voice-wave voice-wave--idle"><span className="voice-state">{company.name.toUpperCase()} WORKSPACE GUIDE</span></div>
                <div className="command-composer"><div><Search size={19}/><input aria-label="Message your workspace assistant" placeholder="Message your workspace assistant…" /></div><footer><button type="button" className="text-button" disabled><Plus size={16}/> Attach files</button><span/><button type="button" className="icon-button" aria-label="Start voice conversation" disabled><Mic size={19}/></button><button type="button" className="icon-button command-send" aria-label="Send assistant question" disabled><ArrowUp size={18}/></button></footer></div>
                <div className="command-shortcuts">{([{ label: '/ meeting', view: 'calendar' }, { label: '/ performance', view: 'analytics' }, { label: '/ files', view: 'files' }, { label: '/ scope draft', view: 'notes' }] as const).map(item => <button key={item.view} onClick={() => onNavigate(item.view)}>{item.label}</button>)}</div>
              </section>
            </section>
            <details className="home-overview"><summary>{company.pipelineTitle} at a glance <span>View summary</span></summary><p>{company.stages.join(" → ")}</p></details>
          </div>) : <CompanyView view={view} title={title ?? ""} />}
        </main>
      </div>
    </div>
  );
}
