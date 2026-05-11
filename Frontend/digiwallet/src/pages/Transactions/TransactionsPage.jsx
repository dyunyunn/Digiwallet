import { useState, useEffect, useCallback } from "react";
import { fetchMyTransactions } from "../../services/transactionService";
import formatRupiah from "../../utils/currency";

// Status badge colors
const STATUS_STYLES = {
  PENDING: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400", label: "Diproses" },
  SUCCESS: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400", label: "Berhasil" },
  FAILED: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400", label: "Gagal" },
  CANCELLED: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400", label: "Dibatalkan" },
  REFUNDED: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400", label: "Refund" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionsPage() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTransactions = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await fetchMyTransactions({ limit: 100 });
      const list = res?.data ?? [];
      const pendingList = list.filter((t) => t.status === "PENDING");
      const historyList = list.filter((t) => t.status !== "PENDING");
      setPending(pendingList);
      setHistory(historyList);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Gagal memuat transaksi.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(true);
    // Auto-refresh every 30 seconds to update pending status without loading spinner
    const interval = setInterval(() => loadTransactions(false), 30000);
    return () => clearInterval(interval);
  }, [loadTransactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Memuat transaksi…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-5 text-center max-w-sm">
          <p className="text-sm font-medium text-red-700 mb-1">Gagal memuat transaksi</p>
          <p className="text-xs text-red-500">{error}</p>
          <button
            onClick={loadTransactions}
            className="mt-3 text-xs font-medium text-purple-600 hover:text-purple-700 cursor-pointer"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Page title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Transaksi</h2>
        <p className="text-sm text-gray-500 mt-1">
          Lihat transaksi yang sedang diproses dan riwayat transaksi Anda.
        </p>
      </div>

      {/* ── Pending / Being Processed ──────────────────────── */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          Sedang Diproses ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">Tidak ada transaksi yang sedang diproses.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((tx) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>

      {/* ── History ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Riwayat Transaksi ({history.length})
        </h3>
        {history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-400">Belum ada riwayat transaksi.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((tx) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionCard({ tx }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4">
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0"
        style={{
          backgroundColor:
            tx.status === "PENDING" ? "#fef3c7" : tx.status === "SUCCESS" ? "#d4f53c20" : "#f3e8ff",
        }}
      >
        {tx.status === "PENDING" ? "⏳" : tx.status === "SUCCESS" ? "✅" : "📋"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {tx.product_name || `Produk #${tx.product_id}`}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {tx.customer_number} · {formatDate(tx.created_at)}
        </p>
      </div>

      {/* Amount + status */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">{formatRupiah(tx.amount)}</p>
        <StatusBadge status={tx.status} />
      </div>
    </div>
  );
}
