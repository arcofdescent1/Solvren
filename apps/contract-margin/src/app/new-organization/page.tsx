import { verifiedUser } from "@/lib/auth";
import { NewOrganizationForm } from "./NewOrganizationForm";

export default async function NewOrganizationPage() {
  await verifiedUser();
  return <main className="frame page"><div className="intro"><span className="eyebrow">Set up Solvren</span><h1 style={{marginTop:18}}>Create your workspace</h1><p>Give your team one secure place to work together. You can invite colleagues once your organization is ready.</p></div>
    <div className="card" style={{maxWidth:620}}><NewOrganizationForm/></div></main>;
}
