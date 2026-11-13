"use client";
import { company } from "./company";
import { staffTabs } from "./staff-dashboard";

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, color: "#888", fontWeight: 500, borderBottom: "1px solid #333", whiteSpace: "nowrap" } as const;
const td = { padding: "11px 14px", fontSize: 12, borderBottom: "1px solid #303030", whiteSpace: "nowrap" } as const;
const note = <p style={{ fontSize: 11, color: "#888", margin: "6px 0 16px" }}>Sample data only. Not connected to any records.</p>;

function Table({ head, rows }: { head: string[]; rows: readonly (readonly string[])[] }) {
  return (
    <div className="table-wrap assignment-table" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{head.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Board({ stages }: { stages: readonly string[] }) {
  return (
    <div className="assignment-board" style={{ gridTemplateColumns: `repeat(${stages.length},240px)`, overflowX: "auto" }}>
      {stages.map(stage => {
        const items = company.queue.filter(q => q[1] === stage);
        return (
          <section className="assignment-column" key={stage}>
            <header><span className="assignment-dot" /><h3>{stage}</h3><small>{items.length}</small></header>
            {items.map(q => (
              <article className="assignment-card" key={q[0]}>
                <span className="tag">{q[6]}</span>
                <span className="assignment-title">{q[0]}</span>
                <p>{q[2]}</p>
                <footer><small>{q[3]}</small><small style={{ marginLeft: "auto" }}>{q[4]}</small></footer>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function CompanyView({ view, title }: { view: string; title: string }) {
  const head = (
    <div className="page-heading"><div><span className="eyebrow">{company.name.toUpperCase()}</span><h1>{title}</h1></div></div>
  );
  if (view === "my-work")
    return <>{head}{note}<Table head={["Client / applicant", "Stage", "Next action", "Owner", "Due", "Blocked reason", "Source"]} rows={company.queue.map(q => [...q])} /></>;
  if (view === "assignments")
    return <>{head}{note}<Table head={["Record", "From", "To (receiving role)", "Task created", "Status"]} rows={company.handoffs.map(h => [...h])} /></>;
  if (view === "contacts")
    return <>{head}{note}<h2 style={{ fontSize: 14, margin: "0 0 12px" }}>{company.pipelineTitle}</h2><Board stages={company.stages} />
      {company.hiringStages && <><h2 style={{ fontSize: 14, margin: "24px 0 12px" }}>Hiring pipeline</h2><Board stages={company.hiringStages} /></>}</>;
  const desc = (company.customDesc as Record<string, string>)[view];
  const known = staffTabs.some(t => t.key === view);
  return <>{head}{desc && <p style={{ fontSize: 13, color: "#aaa", maxWidth: "65ch", lineHeight: 1.6 }}>{desc}</p>}{known && !desc && null}</>;
}
