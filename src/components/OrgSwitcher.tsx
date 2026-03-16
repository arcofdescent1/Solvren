"use client";;
import { NativeSelect } from "@/ui";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type OrgOption = {
  orgId: string;
  orgName: string | null;
  role: string | null;
};

export default function OrgSwitcher(props: {
  options: OrgOption[];
  activeOrgId: string;
}) {
  const { options, activeOrgId } = props;
  const router = useRouter();
  const [value, setValue] = useState(activeOrgId);
  const [saving, setSaving] = useState(false);

  async function onChange(next: string) {
    setValue(next);
    setSaving(true);
    try {
      const resp = await fetch("/api/org/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: next }),
      });
      if (!resp.ok) {
        setValue(activeOrgId);
      }
    } finally {
      setSaving(false);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500">Org</label>
      <NativeSelect
        className="border rounded px-2 py-1 text-sm bg-white"
        value={value}
        onChange={(e) => void onChange(e.target.value)}
        disabled={saving}
      >
        {options.map((o) => (
          <option key={o.orgId} value={o.orgId}>
            {(o.orgName ?? o.orgId).slice(0, 40)}
            {o.role ? ` (${o.role})` : ""}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
