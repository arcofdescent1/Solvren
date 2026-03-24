export { executeMapping, executeMappingWithConfig } from "./executeMapping";
export { resolvePath } from "./pathResolver";
export { applyTransformChain, type TransformSpec } from "./transformEngine";
export { validateCanonical } from "./validateCanonical";
export { formatProviderSchema, inferSchemaFromPayload } from "./providerSchemaService";
export { mapPayloadToCanonicalForIngestion } from "./ingestionBridge";
export type { MappingConfig, MappingFieldRule, ExecuteMappingResult } from "./types";
