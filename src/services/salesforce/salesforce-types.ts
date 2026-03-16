/** Salesforce integration types (IES v1.0) */

export type SalesforceEnvironment = "production" | "sandbox";
export type SalesforceAuthMode = "jwt_bearer" | "client_credentials" | "web_server";

export type SalesforceObjectConfig = {
  objectApiName: string;
  enabled: boolean;
  cdcEnabled: boolean;
  validationEnabled: boolean;
  sensitive: boolean;
};
