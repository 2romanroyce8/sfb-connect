import ProjectsWorkspace from "@/components/team/ProjectsWorkspace";
export const dynamic = "force-dynamic";

/** Client project graph — internal view. Every client space, project switcher, full CRUD. (/team/tasks is the agent task queue and is untouched.) */
export default function ProjectsPage() {
  return <ProjectsWorkspace />;
}
