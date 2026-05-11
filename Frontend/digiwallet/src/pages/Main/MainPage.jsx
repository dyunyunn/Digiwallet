import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser, getUser } from "../../services/authService";
import { getPermissions, getNavigation } from "../../services/configService";
import ProfilePage from "../Profile/ProfilePage";
import TransactionsPage from "../Transactions/TransactionsPage";
import {
  UserManagementPage,
  CategoryManagementPage,
  ProductManagementPage,
  TransactionManagementPage,
  AnalyticsDashboard,
} from "../Admin";
import {
  MAIN_TEXT,
  MOCK_TRANSACTIONS,
  MOCK_STATS,
  QUICK_ACTIONS,
} from "../../constants";
import {
  Sidebar,
  BalanceCard,
  QuickActions,
  TransactionList,
  StatsGrid,
  SpendingChart,
  TopUpModal,
  TopUpBalanceModal,
  ProductCatalog,
} from "../../components/Main";
import formatRupiah from "../../utils/currency";

export default function MainPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const user = getUser();
  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  // All role logic comes from the backend config
  const permissions = getPermissions();
  const isUserDashboard = permissions.dashboardType === "user";

  // Ensure active tab is valid for current nav; if not, switch to first allowed.
  useEffect(() => {
    const nav = getNavigation() || [];
    if (!nav.find((n) => n.id === activeTab)) {
      const first = nav[0]?.id || (isUserDashboard ? "dashboard" : "dashboard");
      setActiveTab(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topUpAction = QUICK_ACTIONS.find((a) => a.id === "topup");
  const userActions = [topUpAction].filter(Boolean);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpCategory, setTopUpCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showTopUpBalance, setShowTopUpBalance] = useState(false);
  const [balanceKey, setBalanceKey] = useState(0);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const handleQuickAction = (actionId) => {
    if (actionId === "topup") {
      setShowTopUpBalance(true);
      return;
    }
    if (actionId === "pay") {
      setTopUpCategory(null);
      setShowTopUp(true);
      return;
    }
    console.log("Quick action:", actionId);
  };

  const handleSelectCategory = (type) => {
    setTopUpCategory(type);
    setSelectedProduct(null);
    setShowTopUp(true);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setTopUpCategory(null);
    setShowTopUp(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* ── USER DASHBOARD (Codashop style) ──────────────── */}
        {isUserDashboard && activeTab === "dashboard" && (
          <div className="min-h-screen bg-gray-50">
            {/* Compact top bar: balance + top-up */}
            <div className="bg-linear-to-r from-gray-900 to-purple-900 px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-400">Saldo Anda</p>
                  <p key={balanceKey} className="text-xl font-bold text-white">
                    {formatRupiah(getUser()?.balance ?? 0)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTopUpBalance(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-900 transition hover:opacity-90 cursor-pointer flex items-center gap-2"
                style={{ backgroundColor: "#d4f53c" }}
              >
                <span>💰</span> Top Up Saldo
              </button>
            </div>

            {/* Hero / Promo banner */}
            <div className="px-8 pt-6 pb-2">
              <div className="relative rounded-2xl overflow-hidden bg-linear-to-r from-purple-700 via-purple-600 to-indigo-600 px-8 py-8 text-white">
                {/* Deco circles */}
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute top-4 right-6 w-20 h-20 rounded-full bg-white/5" />

                <div className="relative z-10 max-w-lg">
                  <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[11px] font-semibold tracking-wide mb-3">
                    PROMO
                  </span>
                  <h2 className="text-2xl font-bold leading-tight mb-2">
                    Top up &amp; bayar tagihan
                    <br />lebih mudah di DigiWallet
                  </h2>
                  <p className="text-sm text-white/70 mb-4 leading-relaxed">
                    Beli pulsa, paket data, token PLN, voucher game, dan lainnya
                    dengan harga terbaik. Pengiriman instan!
                  </p>
                  <button
                    onClick={() => {
                      const el = document.getElementById("product-catalog");
                      el?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-900 transition hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: "#d4f53c" }}
                  >
                    Jelajahi Produk
                  </button>
                </div>
              </div>
            </div>

            {/* Product catalog */}
            <div id="product-catalog" className="px-8 py-6">
              <ProductCatalog onSelectCategory={handleSelectCategory} onSelectProduct={handleSelectProduct} />
            </div>

            {/* Footer */}
            <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
              © 2026 DigiWallet. All rights reserved.{" "}
              <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>
            </footer>
          </div>
        )}

        {/* ── NON-DASHBOARD TABS (shared) ─────────────────── */}
        {activeTab === "profile" && <ProfilePage />}
        {activeTab === "transactions" && <TransactionsPage />}

        {/* ── ADMIN-ONLY PAGES (driven by backend permissions) ─ */}
        {permissions.canManageUsers && activeTab === "users" && <UserManagementPage />}
        {permissions.canManageProducts && activeTab === "products" && <ProductManagementPage />}
        {permissions.canManageCategories && activeTab === "categories" && <CategoryManagementPage />}
        {permissions.canViewAnalytics && activeTab === "analytics" && <AnalyticsDashboard />}

        {/* ── ADMIN DASHBOARD ────────────────────────────── */}
        {!isUserDashboard && activeTab === "dashboard" && (
          <>
            {/* Admin top bar */}
            <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {MAIN_TEXT.WELCOME_BACK}, {displayName} 👋
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {MAIN_TEXT.GREETING_SUBTITLE}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-56 pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button className="relative p-2 text-gray-400 hover:text-gray-600 transition cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </button>
              </div>
            </header>

            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Manajemen Aplikasi</h2>
                <p className="text-sm text-gray-500">Pilih menu di bawah untuk mengelola operasi DigiWallet.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                
                {permissions.canManageProducts && (
                <div onClick={() => setActiveTab('products')} className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-purple-500 hover:shadow-lg transition cursor-pointer flex items-center gap-5">
                  <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">📦</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Produk</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Kelola daftar produk PPOB dan harganya.</p>
                  </div>
                </div>
                )}

                {permissions.canManageCategories && (
                <div onClick={() => setActiveTab('categories')} className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-lg transition cursor-pointer flex items-center gap-5">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">📂</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Kategori</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Atur pengelompokan produk.</p>
                  </div>
                </div>
                )}

                {permissions.canManageUsers && (
                <div onClick={() => setActiveTab('users')} className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-green-500 hover:shadow-lg transition cursor-pointer flex items-center gap-5">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">👥</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Pengguna</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Manajemen pelanggan & admin sistem.</p>
                  </div>
                </div>
                )}
                
                {permissions.canViewAnalytics && (
                <div onClick={() => setActiveTab('analytics')} className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-yellow-500 hover:shadow-lg transition cursor-pointer flex items-center gap-5">
                  <div className="w-14 h-14 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">📈</div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Laporan & Analitik</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Pantau laporan transaksi harian.</p>
                  </div>
                </div>
                )}

              </div>
            </div>

            <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
              © 2026 DigiWallet. All rights reserved.{" "}
              <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>
            </footer>
          </>
        )}
      </main>

      {/* Top-Up / Buy Product Modal */}
      {showTopUp && (
        <TopUpModal
          initialType={topUpCategory}
          initialProduct={selectedProduct}
          onClose={() => { setShowTopUp(false); setTopUpCategory(null); setSelectedProduct(null); }}
          onSuccess={() => { setShowTopUp(false); setTopUpCategory(null); setSelectedProduct(null); }}
        />
      )}

      {/* Top-Up Balance Modal */}
      {showTopUpBalance && (
        <TopUpBalanceModal
          onClose={() => setShowTopUpBalance(false)}
          onSuccess={() => {
            setShowTopUpBalance(false);
            setBalanceKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

