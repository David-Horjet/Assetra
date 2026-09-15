import { BorrowPreview } from "./BorrowPreview";
import { getPortfolio } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

/**
 * Dev-only preview of the borrow sheet against real vault data, so the
 * screen can be reviewed without clicking through the wallet flow.
 */
export default async function Page({ searchParams }: PageProps<"/preview/borrow">) {
  const params = await searchParams;
  const w = params.wallet;
  const wallet = Array.isArray(w) ? w[0] : w;
  if (!wallet) return <div className="p-10">Add ?wallet=&lt;address&gt;</div>;

  const snapshot = await getPortfolio(wallet);
  const holding = snapshot.holdings.find((h) => h.vaults.length > 0);
  if (!holding) return <div className="p-10">No borrowable holding found.</div>;

  return <BorrowPreview holding={holding} />;
}
