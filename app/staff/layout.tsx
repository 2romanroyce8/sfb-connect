import type { ReactNode } from "react";
import "./light.generated.css";
import "./appearance.css";
import "./team-chat.css";
import "./invitation-cards.css";
import "./team.css";
import "./staff.css";
import "./productivity.css";

export const metadata = {
  title: "Staff CRM",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <div className="sfb-hq sfb-staff">{children}</div>;
}
