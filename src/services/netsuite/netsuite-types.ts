export type NetSuiteAccount = { id: string; org_id: string; account_id: string; environment: string };
export type NetSuiteRecordConfig = { record_type: string; enabled: boolean };
export type NetSuiteValidationTemplate = { id: string; name: string; template_type: string; query_text: string | null };
