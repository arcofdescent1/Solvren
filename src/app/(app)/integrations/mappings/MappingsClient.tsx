"use client";

/**
 * Phase 1 — Mappings list + editor client.
 */
import { useState } from "react";
import { Button, Card, CardBody, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui";
import { MappingEditor } from "./MappingEditor";

type MappingRow = {
  id: string;
  provider_key: string;
  source_object_type: string;
  canonical_object_type: string;
  version: number;
  status: string;
  is_active: boolean;
  fields?: Array<{
    source_path: string;
    canonical_field: string;
    transform_chain?: unknown;
    default_value?: string | null;
  }>;
};

type TemplateRow = {
  id: string;
  provider_key: string;
  source_object_type: string;
  canonical_object_type: string;
  name: string;
  fields?: Array<{
    source_path: string;
    canonical_field: string;
    transform_chain?: unknown;
    default_value?: string | null;
  }>;
};

export default function MappingsClient({
  orgId,
  initialMappings,
  templates,
  isAdmin,
}: {
  orgId: string;
  initialMappings: MappingRow[];
  templates: TemplateRow[];
  isAdmin: boolean;
}) {
  const [mappings, setMappings] = useState(initialMappings);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [tab, setTab] = useState<"list" | "editor">("list");

  const selected = selectedId === "new" ? null : mappings.find((m) => m.id === selectedId);
  const isEditing = selectedId !== null;

  const refreshMappings = async () => {
    const res = await fetch(`/api/integrations/mappings?orgId=${encodeURIComponent(orgId)}`);
    const json = await res.json();
    if (json.ok && json.mappings) setMappings(json.mappings);
  };

  const handleCloseEditor = () => {
    setSelectedId(null);
    setTab("list");
    refreshMappings();
  };

  return (
    <div className="mt-6 space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "list" | "editor")}>
        <TabsList>
          <TabsTrigger value="list" onClick={() => setTab("list")}>
            Mappings
          </TabsTrigger>
          <TabsTrigger value="editor" onClick={() => setTab("editor")} disabled={!isEditing}>
            {selectedId === "new" ? "New Mapping" : selected ? "Edit" : "Editor"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--text-muted)]">
              {mappings.length} mapping{mappings.length !== 1 ? "s" : ""}
            </p>
            {isAdmin && (
              <Button
                onClick={() => {
                  setSelectedId("new");
                  setTab("editor");
                }}
              >
                New mapping
              </Button>
            )}
          </div>

          {mappings.length === 0 ? (
            <Card className="mt-4">
              <CardBody>
                <p className="text-sm text-[var(--text-muted)]">No mappings yet.</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Create a mapping to connect provider objects (e.g. HubSpot contacts) to canonical models (e.g. Customer).
                </p>
                {isAdmin && (
                  <Button className="mt-4" onClick={() => { setSelectedId("new"); setTab("editor"); }}>
                    Create first mapping
                  </Button>
                )}
              </CardBody>
            </Card>
          ) : (
            <div className="mt-4 space-y-2">
              {mappings.map((m) => (
                <Card
                  key={m.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--bg-muted)]/50"
                  onClick={() => {
                    setSelectedId(m.id);
                    setTab("editor");
                  }}
                >
                  <CardBody className="flex flex-row items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-[var(--text)]">
                        {m.provider_key} / {m.source_object_type}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">→ {m.canonical_object_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.is_active ? "success" : "outline"}>
                        {m.is_active ? "Active" : "Draft"}
                      </Badge>
                      <Badge variant="secondary">v{m.version}</Badge>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor" className="mt-4">
          {isEditing && (
            <MappingEditor
              orgId={orgId}
              mappingId={selectedId === "new" ? null : selectedId}
              mapping={selected ?? undefined}
              templates={templates}
              isAdmin={isAdmin}
              onClose={handleCloseEditor}
              onSaved={refreshMappings}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
