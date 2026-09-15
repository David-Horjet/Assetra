import { getOperateIx } from "@jup-ag/lend/borrow";
import { Connection, PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from "@solana/web3.js";
import BN from "bn.js";

const RPC = "https://mainnet.helius-rpc.com/?api-key=cb4cf80a-42b2-4f27-90b6-dcfe0fe6b4cd";
const conn = new Connection(RPC, "confirmed");

// A real holder of NVDAx (token account owner), used read-only to prove the
// builder produces a serialisable transaction against live vault state.
const vaults = await (await fetch("https://lite-api.jup.ag/lend/v1/borrow/vaults")).json();
const v = vaults.find(x => x.supplyToken?.symbol === "NVDAx" && x.borrowToken?.symbol === "USDC");
console.log("vault id:", v.id, "| collateral:", v.supplyToken.symbol, "| borrow:", v.borrowToken.symbol);

// Arbitrary signer: we are only building + simulating, never signing.
const signer = new PublicKey("Sk6YCd1SfTsJatrZRPnH5g69ZHKsXw12GVpasouQAF8");

const colRaw = 10_000_000n;   // 0.1 NVDAx  (8dp)
const debtRaw = 2_000_000n;   // 2.00 USDC  (6dp) — above the ~$1.02 minimum

console.log("\nbuilding: deposit 0.1 NVDAx, borrow 2.00 USDC ...");
const t0 = Date.now();
const res = await getOperateIx({
  vaultId: v.id, positionId: 0,
  colAmount: new BN(colRaw.toString()),
  debtAmount: new BN(debtRaw.toString()),
  connection: conn, signer, market: "main", includeATASetup: true,
});
console.log("built in", Date.now()-t0, "ms");
console.log("ixs:", res.ixs.length, "| ALTs:", res.addressLookupTableAccounts?.length ?? 0, "| nftId:", res.nftId);

const { blockhash } = await conn.getLatestBlockhash("confirmed");
const msg = new TransactionMessage({
  payerKey: signer, recentBlockhash: blockhash,
  instructions: [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000 }),
    ...res.ixs,
  ],
}).compileToV0Message(res.addressLookupTableAccounts ?? []);

const tx = new VersionedTransaction(msg);
const size = tx.serialize().length;
console.log("tx size:", size, "bytes", size <= 1232 ? "OK (<=1232)" : "TOO LARGE");
console.log("accounts in message:", msg.staticAccountKeys.length);
