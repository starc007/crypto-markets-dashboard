import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell title="Not found" subtitle="We only track the current top 50 assets by market cap.">
      <Link href="/" className="text-sm font-medium underline underline-offset-4">
        Back to markets
      </Link>
    </PageShell>
  );
}
