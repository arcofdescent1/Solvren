import { RevenueImpactCard } from "@/components/revenueImpact/RevenueImpactCard";

export default function RevenueImpactReportPanel(props: { changeId: string }) {
  return <RevenueImpactCard changeId={props.changeId} />;
}
