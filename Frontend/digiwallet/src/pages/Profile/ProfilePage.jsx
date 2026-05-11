import { useState, useEffect, useRef } from "react";
import { getUser } from "../../services/authService";
import { fetchMyProfile, updateMyProfile } from "../../services/profileService";
import formatRupiah from "../../utils/currency";

// ── Avatar initials helper ─────────────────────────────────────────────────
function AvatarCircle({ name, size = "lg" }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizes = {
    lg: "w-24 h-24 text-3xl",
    sm: "w-10 h-10 text-sm",
  };

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-gray-900 shrink-0`}
      style={{ backgroundColor: "#d4f53c" }}
    >
      {initials}
    </div>
  );
}

// ── Read-only field ────────────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-sm text-gray-800 ${mono ? "font-mono" : "font-medium"}`}
      >
        {value || <span className="text-gray-300 italic">—</span>}
      </span>
    </div>
  );
}

// ── Edit field ─────────────────────────────────────────────────────────────
function EditField({ label, name, type = "text", value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border text-sm text-gray-800 outline-none transition
          ${
            disabled
              ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-white border-gray-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          }`}
      />
    </div>
  );
}

// ── Stat badge ─────────────────────────────────────────────────────────────
function StatBadge({ label, value, color = "purple" }) {
  const colors = {
    purple: "bg-purple-50 text-purple-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    gray: "bg-gray-100 text-gray-600",
  };
  return (
    <div className={`flex flex-col items-center px-5 py-3 rounded-xl ${colors[color]}`}>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs mt-0.5 opacity-75">{label}</span>
    </div>
  );
}

// ── Main profile component ─────────────────────────────────────────────────
export default function ProfilePage() {
  // We no longer rely on client-side stored user id; backend exposes /users/me

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const successTimer = useRef(null);

  // Load profile from backend
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMyProfile()
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message || err.message || "Failed to load profile."
        );
        setLoading(false);
      });
  }, []);

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        phone_number: profile.phone_number || "",
        monthly_limit: profile.monthly_limit || "",
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = () => {
    setSaveError(null);
    setSaveSuccess(false);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveError(null);
    // Reset form back to current profile values
    setForm({
      name: profile.name || "",
      email: profile.email || "",
      phone_number: profile.phone_number || "",
      monthly_limit: profile.monthly_limit || "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMyProfile(form);
      setProfile((prev) => ({ ...prev, ...updated }));
      setSaveSuccess(true);
      setEditing(false);
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err?.response?.data?.message || err.message || "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Format helpers ─────────────────────────────────────────────────────
  const formatCurrency = (val) => formatRupiah(val);

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading profile…</span>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-5 text-center max-w-sm">
          <p className="text-sm font-medium text-red-700 mb-1">
            Could not load profile
          </p>
          <p className="text-xs text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || profile?.email?.split("@")[0] || "User";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* ── Page title ─────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
        <p className="text-sm text-gray-500 mt-1">
          View and manage your personal account information.
        </p>
      </div>

      {/* ── Success toast ──────────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="mb-6 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Profile updated successfully!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left card: avatar + stats ───────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center text-center">
            <AvatarCircle name={displayName} />
            <h3 className="mt-4 text-base font-bold text-gray-900">{displayName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{profile?.email}</p>


            {/* Member since */}
            <p className="text-xs text-gray-400 mt-4">
              Member since{" "}
              <span className="font-medium text-gray-600">
                {formatDate(profile?.created_at)}
              </span>
            </p>
          </div>

          {/* Balance stat */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Account Balance
            </p>
            <p
              className="text-2xl font-bold"
              style={{ color: "#4a9d00" }}
            >
              {formatCurrency(profile?.balance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Available for transactions</p>
          </div>

          {/* Stats row */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Account Info
            </p>
            <div className="flex gap-2 flex-wrap">
              <StatBadge
                label="Role"
                value={profile?.role || "USER"}
                color="purple"
              />
              <StatBadge
                 label="Monthly Limit"
                 value={profile?.monthly_limit > 0 ? formatCurrency(profile?.monthly_limit) : "Unlimited"}
                 color="yellow"
              />
            </div>
          </div>
        </div>

        {/* ── Right card: detail / edit form ─────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-gray-900">
              Personal Information
            </h3>
            {!editing ? (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Save error */}
          {saveError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-xs">
              {saveError}
            </div>
          )}

          {editing ? (
            /* ── Edit mode ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <EditField
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
              <EditField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
              <EditField
                label="Phone Number"
                name="phone_number"
                type="tel"
                value={form.phone_number}
                onChange={handleChange}
              />
              <EditField
                label="Monthly Limit"
                name="monthly_limit"
                type="number"
                value={form.monthly_limit}
                onChange={handleChange}
              />
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 -mt-2.5">
                  *Set limit bulanan Anda. Masukkan 0 jika tidak ingin menggunakan limit pengeluaran per bulan.
                </p>
              </div>
              {/* Read-only fields in edit mode */}
              {/* Role field hidden in edit mode */}
            </div>
          ) : (
            /* ── View mode ── */
            <div>
              <InfoRow label="Full Name" value={profile?.name} />
              <InfoRow label="Email Address" value={profile?.email} />
              <InfoRow
                label="Phone Number"
                value={profile?.phone_number}
                mono
              />
              {/* Role field hidden in view mode */}
              <InfoRow
                label="Account Status"
                value={profile?.is_active ? "Active ✓" : "Inactive"}
              />
              {/* User ID intentionally hidden from profile view */}
              <InfoRow
                label="Joined"
                value={formatDate(profile?.created_at)}
              />
              {profile?.updated_at && (
                <InfoRow
                  label="Last Updated"
                  value={formatDate(profile?.updated_at)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
