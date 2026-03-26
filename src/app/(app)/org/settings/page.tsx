import { redirect } from "next/navigation";

export default async function OrgSettingsRootRedirectPage() {
  redirect("/settings");
}

