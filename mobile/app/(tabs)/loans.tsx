import { AppScreen } from "../../components/AppScreen";
import { EmptyStateCard } from "../../components/EmptyStateCard";

export default function LoansScreen() {
  return (
    <AppScreen title="Loans" subtitle="Keep EMI and dues simple and visible.">
      <EmptyStateCard title="No loans or EMI yet" body="This first scaffold is ready for loan cards, due-soon lists, and mark-paid actions next." />
    </AppScreen>
  );
}
