"use client";

/**
 * Phase 1 — Mapping editor (§9).
 */
import { useState, useEffect, useCallback } from "react";
import { Button, Card, CardBody, Input, Badge, NativeSelect, Textarea } from "@/ui";
import { CanonicalObjectType, getCanonicalFields } from "@/lib/integrations/canonicalSchema";
import { inferSchemaFromPayload } from "@/lib/integrations/mapping/providerSchemaService";

const PROVIDERS = ["hubspot", "salesforce", "stripe"] as const;

function coerceTransformChain(chain: unknown): Array<{ type: string }> {
  if (!Array.isArray(chain)) return [];
  return chain.filter(
    (c): c is { type: string } =>
      c != null && typeof c === "object" && typeof (c as { type?: unknown }).type === "string"
  ) as Array<{ type: string }>;
}

type FieldRule = {
  source_path: string;
  canonical_field: string;
  transform_chain?: Array<{ type: string }>;
  default_value?: string | null;
};

type SchemaField = { path: string; type: string; label?: string };

type Template = {
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

type Mapping = {
  id: string;
  provider_key: string;
  source_object_type: string;
  canonical_object_type: string;
  status: string;
  is_active: boolean;
  fields?: Array<{
    source_path: string;
    canonical_field: string;
    transform_chain?: unknown;
    default_value?: string | null;
  }>;
};

export function MappingEditor({
  orgId,
  mappingId,
  mapping,
  templates,
  isAdmin,
  onClose,
  onSaved,
}: {
  orgId: string;
  mappingId: string | null;
  mapping?: Mapping;
  templates: Template[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState(mapping?.provider_key ?? "hubspot");
  const [sourceObject, setSourceObject] = useState(mapping?.source_object_type ?? "contacts");
  const [canonicalType, setCanonicalType] = useState<CanonicalObjectType>(mapping?.canonical_object_type as CanonicalObjectType ?? "Customer");
  const [fields, setFields] = useState<FieldRule[]>(() =>
    (mapping?.fields ?? []).map((f) => ({
      source_path: f.source_path,
      canonical_field: f.canonical_field,
      transform_chain: coerceTransformChain(f.transform_chain),
      default_value: f.default_value ?? null,
    }))
  );
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [schemaMode, setSchemaMode] = useState<"provider" | "sample">("provider");
  const [sampleJson, setSampleJson] = useState("{}");
  const [samplePayload, setSamplePayload] = useState<unknown>(null);
  const [testResult, setTestResult] = useState<{ status: string; canonical: unknown; errors: string[]; warnings: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchProviderSchema = useCallback(async () => {
    if (provider !== "hubspot" && provider !== "salesforce") return;
    const res = await fetch(
      `/api/integrations/schema/${provider}/${encodeURIComponent(sourceObject)}?orgId=${encodeURIComponent(orgId)}`
    );
    const json = await res.json();
    if (json.ok && json.fields) setSchemaFields(json.fields);
    else setSchemaFields([]);
  }, [orgId, provider, sourceObject]);

  useEffect(() => {
    if (schemaMode === "provider" && (provider === "hubspot" || provider === "salesforce")) {
      fetchProviderSchema();
    } else if (schemaMode === "sample") {
      try {
        const parsed = JSON.parse(sampleJson || "{}");
        setSamplePayload(parsed);
        const { fields: inferred } = inferSchemaFromPayload(parsed);
        setSchemaFields(inferred);
      } catch {
        setSchemaFields([]);
        setSamplePayload(null);
      }
    }
  }, [schemaMode, provider, sourceObject, sampleJson, fetchProviderSchema]);

  const applyTemplate = (template: Template) => {
    setProvider(template.provider_key);
    setSourceObject(template.source_object_type);
    setCanonicalType(template.canonical_object_type as CanonicalObjectType);
    setFields(
      (template.fields ?? []).map((f) => ({
        source_path: f.source_path,
        canonical_field: f.canonical_field,
        transform_chain: coerceTransformChain(f.transform_chain),
        default_value: f.default_value ?? null,
      }))
    );
  };

  const addField = () => {
    setFields((f) => [...f, { source_path: "", canonical_field: "", transform_chain: [], default_value: null }]);
  };

  const updateField = (i: number, updates: Partial<FieldRule>) => {
    setFields((f) => {
      const next = [...f];
      next[i] = { ...next[i], ...updates };
      return next;
    });
  };

  const removeField = (i: number) => {
    setFields((f) => f.filter((_, j) => j !== i));
  };

  const runTest = async () => {
    let payload: unknown;
    if (schemaMode === "sample") {
      try {
        payload = JSON.parse(sampleJson || "{}");
      } catch {
        setTestResult({ status: "failed", canonical: null, errors: ["Invalid sample JSON"], warnings: [] });
        return;
      }
    } else {
      payload = samplePayload ?? JSON.parse(sampleJson || "{}");
    }
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        orgId,
        payload,
      };
      if (mappingId) body.mapping_id = mappingId;
      else body.provider_key = provider;
      if (!mappingId) body.source_object_type = sourceObject;
      if (!mappingId) body.canonical_object_type = canonicalType;
      if (!mappingId) body.fields = fields;

      const res = await fetch("/api/integrations/mappings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setTestResult({
        status: json.status ?? "failed",
        canonical: json.canonical ?? null,
        errors: json.errors ?? [],
        warnings: json.warnings ?? [],
      });
    } catch (e) {
      setTestResult({
        status: "failed",
        canonical: null,
        errors: [e instanceof Error ? e.message : "Test failed"],
        warnings: [],
      });
    } finally {
      setTesting(false);
    }
  };

  const saveMapping = async () => {
    setSaving(true);
    try {
      if (!mappingId) {
        const res = await fetch(`/api/integrations/mappings?orgId=${encodeURIComponent(orgId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_key: provider,
            source_object_type: sourceObject,
            canonical_object_type: canonicalType,
            fields,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          onSaved();
          onClose();
        }
      } else {
        const res = await fetch(`/api/integrations/mappings/${mappingId}?orgId=${encodeURIComponent(orgId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields, canonical_object_type: canonicalType }),
        });
        const json = await res.json();
        if (json.ok) {
          onSaved();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const activateMapping = async () => {
    if (!mappingId) return;
    const res = await fetch(`/api/integrations/mappings/${mappingId}/activate?orgId=${encodeURIComponent(orgId)}`, {
      method: "POST",
    });
    if (res.ok) {
      onSaved();
    }
  };

  const canonicalFields = getCanonicalFields(canonicalType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{mappingId === "new" || !mappingId ? "New mapping" : "Edit mapping"}</h2>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <Card>
        <CardBody className="space-y-4">
          <h3 className="font-medium">Source selection</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Provider</label>
              <NativeSelect
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={!!mappingId}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--text-muted)]">Source object</label>
              <Input
                value={sourceObject}
                onChange={(e) => setSourceObject(e.target.value)}
                placeholder="e.g. contacts, deals"
                disabled={!!mappingId}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h3 className="font-medium">Source schema</h3>
          <div className="flex gap-2">
            <Button
              variant={schemaMode === "provider" ? "default" : "outline"}
              size="sm"
              onClick={() => setSchemaMode("provider")}
            >
              From provider
            </Button>
            <Button
              variant={schemaMode === "sample" ? "default" : "outline"}
              size="sm"
              onClick={() => setSchemaMode("sample")}
            >
              Sample JSON
            </Button>
          </div>
          {schemaMode === "provider" && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={fetchProviderSchema}>
                Refresh schema
              </Button>
              <span className="text-sm text-[var(--text-muted)]">{schemaFields.length} fields</span>
            </div>
          )}
          {schemaMode === "sample" && (
            <Textarea
              value={sampleJson}
              onChange={(e) => setSampleJson(e.target.value)}
              placeholder='{"properties": {"email": "a@b.com"}, ...}'
              rows={6}
              className="font-mono text-sm"
            />
          )}
          {schemaFields.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border border-[var(--border)] p-2 text-sm">
              {schemaFields.slice(0, 30).map((f) => (
                <div key={f.path} className="font-mono text-[var(--text-muted)]">
                  {f.path} ({f.type})
                </div>
              ))}
              {schemaFields.length > 30 && <div className="text-[var(--text-muted)]">… +{schemaFields.length - 30} more</div>}
            </div>
          )}
        </CardBody>
      </Card>

      {templates.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="mb-2 font-medium">Apply template</h3>
            <div className="flex flex-wrap gap-2">
              {templates
                .filter((t) => t.provider_key === provider || !provider)
                .map((t) => (
                  <Badge
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => applyTemplate(t)}
                  >
                    {t.name || `${t.provider_key} / ${t.source_object_type} → ${t.canonical_object_type}`}
                  </Badge>
                ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Mapping table</h3>
            <Button size="sm" onClick={addField}>
              Add field
            </Button>
          </div>
          <div className="space-y-2">
            {fields.map((rule, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-[var(--border)] p-2">
                <Input
                  placeholder="Source path (e.g. properties.email)"
                  value={rule.source_path}
                  onChange={(e) => updateField(i, { source_path: e.target.value })}
                  className="flex-1 min-w-[140px]"
                />
                <span className="text-[var(--text-muted)]">→</span>
                <NativeSelect
                  value={rule.canonical_field}
                  onChange={(e) => updateField(i, { canonical_field: e.target.value })}
                  className="min-w-[140px]"
                >
                  <option value="">Select canonical field</option>
                  {canonicalFields.map((cf) => (
                    <option key={cf} value={cf}>{cf}</option>
                  ))}
                </NativeSelect>
                <Input
                  placeholder="Default"
                  value={rule.default_value ?? ""}
                  onChange={(e) => updateField(i, { default_value: e.target.value || null })}
                  className="w-24"
                />
                <Button variant="outline" size="sm" onClick={() => removeField(i)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          {fields.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">Add mapping rules above. Source paths from schema panel.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="mb-2 font-medium">Test</h3>
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            {schemaMode === "sample" ? "Uses sample JSON as payload." : "Paste sample JSON in Source schema to test."}
          </p>
          <Button onClick={runTest} disabled={testing}>
            {testing ? "Running…" : "Run test"}
          </Button>
          {testResult && (
            <div className="mt-4 space-y-2">
              <Badge variant={testResult.status === "success" ? "success" : testResult.status === "warning" ? "secondary" : "danger"}>
                {testResult.status}
              </Badge>
              {testResult.errors.length > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {testResult.errors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              )}
              {testResult.canonical != null && (
                <pre className="max-h-48 overflow-auto rounded bg-[var(--bg-muted)] p-2 text-xs">
                  {JSON.stringify(testResult.canonical as Record<string, unknown>, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {isAdmin && (
        <div className="flex gap-2">
          <Button onClick={() => { setSaving(true); saveMapping(); }}>
            {saving ? "Saving…" : mappingId ? "Save" : "Create"}
          </Button>
          {mappingId && !mapping?.is_active && (
            <Button variant="default" onClick={activateMapping}>
              Activate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
