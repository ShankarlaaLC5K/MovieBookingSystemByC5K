import { useEffect, useState } from "react";
import { ArrowDownLeft, RefreshCw, Wallet as WalletIcon } from "lucide-react";
import { getWallet } from "../services/walletService";
import type { WalletTransaction } from "../services/walletService";

function formatMoney(amount: number): string {
  return "₹" + Number(amount || 0).toFixed(2);
}

function Wallet() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getWallet();

      setBalance(response.walletBalance);
      setTransactions(response.transactions || []);
    } catch (walletError: any) {
      setError(
        walletError?.response?.data?.message ||
          "Unable to load your wallet."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  return (
    <section className="min-h-[calc(100vh-140px)] bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Wallet</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              View your eligible refunds and wallet transactions.
            </p>
          </div>

          <button
            type="button"
            onClick={loadWallet}
            disabled={loading}
            aria-label="Refresh wallet"
            className="rounded-lg border border-slate-300 p-3 disabled:opacity-50 dark:border-slate-700"
          >
            <RefreshCw size={19} />
          </button>
        </div>

        <div className="rounded-2xl bg-linear-to-br from-red-600 to-red-800 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <WalletIcon size={26} />
            </div>
            <div>
              <p className="text-sm text-white/80">Available wallet balance</p>
              <p className="mt-1 text-3xl font-bold">
                {loading ? "Loading..." : formatMoney(balance)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">Transaction History</h2>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">
              Loading transactions...
            </div>
          ) : !transactions.length ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <WalletIcon size={30} className="mx-auto text-slate-400" />
              <p className="mt-4 font-semibold">No wallet transactions yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Eligible reschedule or cancellation refunds will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction._id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-full bg-green-500/10 p-3 text-green-600">
                      <ArrowDownLeft size={20} />
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold">
                        {transaction.type === "cancellation_refund"
                          ? "Cancellation Refund"
                          : "Reschedule Refund"}
                      </p>

                      <p className="mt-1 wrap-break-word text-sm text-slate-500 dark:text-slate-400">
                        {transaction.description}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 font-bold text-green-600">
                    +{formatMoney(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Wallet;