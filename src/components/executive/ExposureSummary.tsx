import { formatDepartmentSystemLists } from "@/lib/executive/buildExecutiveChangeView";
import type { ExecutiveChangeView } from "@/lib/executive/types";

export function ExposureSummary({ view }: { view: ExecutiveChangeView }) {
  const { departmentsLine, systemsLine } = formatDepartmentSystemLists(view);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-[var(--text)]">Revenue and customer exposure</h2>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-sm leading-7 text-[var(--text)]">
        <p>
          <span className="font-semibold">Revenue at risk:</span> {view.displayRevenueAtRisk ?? "Not estimated"}
        </p>
        {view.customersAffectedDisplay ? (
          <p>
            <span className="font-semibold">Customers potentially impacted:</span> {view.customersAffectedDisplay}
          </p>
        ) : null}
        <p>
          <span className="font-semibold">Departments affected:</span> {departmentsLine}
        </p>
        <p>
          <span className="font-semibold">Systems affected:</span> {systemsLine}
        </p>
      </div>
    </section>
  );
}
