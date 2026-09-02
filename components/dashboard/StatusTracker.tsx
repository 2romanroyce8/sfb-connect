import { PROJECT_STATUS_LABELS, PROJECT_STATUS_ORDER, ProjectStatus } from "@/lib/types";

export default function StatusTracker({ status }: { status: ProjectStatus }) {
  const currentIndex = PROJECT_STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-center overflow-x-auto pb-2">
      {PROJECT_STATUS_ORDER.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-2 min-w-[92px]">
              <div
                className={`w-3 h-3 rounded-full ${
                  done || active ? "bg-white" : "bg-white/15"
                } ${active ? "ring-4 ring-white/20" : ""}`}
              />
              <span
                className={`text-[11.5px] font-mono text-center ${
                  active ? "text-white font-semibold" : "text-medium-gray"
                }`}
              >
                {PROJECT_STATUS_LABELS[s]}
              </span>
            </div>
            {i < PROJECT_STATUS_ORDER.length - 1 && (
              <div
                className={`h-px w-10 md:w-14 ${
                  i < currentIndex ? "bg-white/50" : "bg-white/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
