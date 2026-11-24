import { redirect } from "next/navigation";

// Old combined page → the two separate services.
export default async function Utilities({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  redirect(tab === "recharge" ? "/recharge" : "/electricity");
}
