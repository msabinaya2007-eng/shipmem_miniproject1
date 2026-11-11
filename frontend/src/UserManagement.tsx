import { useEffect, useState, type FormEvent } from "react";
import {
  ShieldCheck,
  UserPlus,
  Users,
  RefreshCw,
  CheckCircle2,
  CircleAlert,
  UserCheck,
  UserX,
  X,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  User as UserIcon,
  ShieldAlert,
} from "lucide-react";

import {
  createAdmin,
  createStaff,
  fetchAllUsers,
  fetchStaffUsers,
  updateUserStatus,
  type User,
  type CreateUserData,
} from "./api";

interface UserManagementProps {
  currentUser: User;
}

export default function UserManagement({ currentUser }: UserManagementProps) {
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isAdmin = currentUser.role === "ADMIN";
  const isStaff = currentUser.role === "STAFF";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Message states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");

  async function loadUsers() {
    if (isStaff) return;

    setLoading(true);
    setError("");

    try {
      const result = isSuperAdmin
        ? await fetchAllUsers()
        : isAdmin
          ? await fetchStaffUsers()
          : [];

      setUsers(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load accounts from the server."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      if (isStaff) return;
      setLoading(true);
      setError("");

      try {
        const result = isSuperAdmin
          ? await fetchAllUsers()
          : isAdmin
            ? await fetchStaffUsers()
            : [];

        if (isMounted) {
          setUsers(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load accounts from the server."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      isMounted = false;
    };
  }, [currentUser.role, currentUser.user_id, isSuperAdmin, isAdmin, isStaff]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormError("");
  }

  function openCreateModal() {
    resetForm();
    setFormOpen(true);
  }

  function closeCreateModal() {
    resetForm();
    setFormOpen(false);
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    // Required fields check
    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setFormError("All fields are required.");
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    // Password length validation
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    // Password match check
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    const payload: CreateUserData = {
      full_name: trimmedName,
      email: trimmedEmail,
      password,
    };

    try {
      setSaving(true);

      if (isSuperAdmin) {
        // Super Admin automatically creates ADMIN
        await createAdmin(payload);
        setSuccess(`Admin account for "${trimmedName}" created successfully.`);
      } else if (isAdmin) {
        // Admin automatically creates STAFF
        await createStaff(payload);
        setSuccess(`Staff account for "${trimmedName}" created successfully.`);
      } else {
        throw new Error("You do not have permission to create accounts.");
      }

      closeCreateModal();
      await loadUsers();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create account."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(targetUser: User) {
    if (targetUser.user_id === currentUser.user_id) {
      setError("You cannot deactivate or modify your own account.");
      return;
    }

    if (targetUser.role === "SUPER_ADMIN") {
      setError("Super Admin accounts cannot be deactivated through ordinary management.");
      return;
    }

    const action = targetUser.is_active ? "deactivate" : "activate";
    const confirmMessage = `Are you sure you want to ${action} the account for "${targetUser.full_name}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await updateUserStatus(targetUser.user_id, !targetUser.is_active);
      setSuccess(
        `Account "${targetUser.full_name}" has been ${action}d successfully.`
      );
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} account.`
      );
    }
  }

  const roleBadge = (role: User["role"]) => {
    switch (role) {
      case "SUPER_ADMIN":
        return {
          label: "Super Admin",
          className: "bg-[#dce9f2] text-[#0f3b4f] border-[#b5d5e6] font-bold",
        };
      case "ADMIN":
        return {
          label: "Admin",
          className: "bg-[#daf0e7] text-[#0f5c54] border-[#bfe2d6] font-bold",
        };
      case "STAFF":
        return {
          label: "Staff",
          className: "bg-[#eef2f0] text-[#1c3e39] border-[#d0ded8] font-bold",
        };
    }
  };

  // Prevent direct access for STAFF
  if (isStaff) {
    return (
      <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-8 text-center">
        <ShieldAlert className="mx-auto text-[#b91c1c]" size={42} />
        <h3 className="mt-4 text-xl font-bold text-[#0f2d3a]">
          Access Restricted
        </h3>
        <p className="mt-2 text-sm font-medium text-[#264d45]">
          Staff accounts do not have permission to access User Management.
        </p>
      </div>
    );
  }

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[2px] text-[#246359]">
            <ShieldCheck size={16} />
            {isSuperAdmin ? "System Administration" : "Operations Management"}
          </div>

          <h2 className="text-3xl font-extrabold text-[#0f2d3a]">
            {isSuperAdmin ? "User Management" : "Staff Management"}
          </h2>

          <p className="mt-2 text-sm font-medium text-[#2d4d46]">
            {isSuperAdmin
              ? "Oversee all registered Administrator and Staff accounts across the SHIPMEM fleet."
              : "Manage staff accounts registered and assigned by your administration."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadUsers()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#cad8ce] bg-white px-4 py-3 text-sm font-bold text-[#185e54] transition hover:bg-[#eef5f1] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          {isSuperAdmin && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-[#186862] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#12534e]"
            >
              <UserPlus size={17} />
              Add Admin
            </button>
          )}

          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-[#186862] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#12534e]"
            >
              <UserPlus size={17} />
              Add Staff
            </button>
          )}
        </div>
      </div>

      {/* ACCESS LEVEL SUMMARY CARD */}
      <div className="rounded-2xl border border-[#cbe5dc] bg-[#eef7f2] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-[#146459]" size={22} />
          <div>
            <h3 className="text-sm font-bold text-[#0f2d3a]">
              Authenticated as {isSuperAdmin ? "Super Administrator" : "Administrator"} ({currentUser.full_name})
            </h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-[#23453e]">
              {isSuperAdmin
                ? "You hold full platform administrative authority. You can create Admin accounts, review all fleet users, and manage account statuses. Your own Super Admin account is protected."
                : "You have administrator authority. You can create Staff accounts and activate or deactivate Staff accounts created by you."}
            </p>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-[#f0d5ce] bg-[#fff3ef] p-4 text-sm font-medium text-[#b76559]">
          <CircleAlert size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-[#b76559] hover:opacity-75">
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-[#d3e9dd] bg-[#edf8f1] p-4 text-sm font-semibold text-[#18684d]">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess("")} className="text-[#18684d] hover:opacity-75">
            <X size={16} />
          </button>
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#d5ded8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-[#146459]">
            <Users size={20} />
            <span className="text-xs font-bold text-[#2d524a]">
              {isSuperAdmin ? "Total Users" : "Assigned Staff"}
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0f2d3a]">{users.length}</p>
        </div>

        <div className="rounded-2xl border border-[#d5ded8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-[#166534]">
            <UserCheck size={20} />
            <span className="text-xs font-bold text-[#2d524a]">Active Accounts</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0f2d3a]">{activeCount}</p>
        </div>

        <div className="rounded-2xl border border-[#d5ded8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-[#991b1b]">
            <UserX size={20} />
            <span className="text-xs font-bold text-[#2d524a]">Inactive Accounts</span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#0f2d3a]">{inactiveCount}</p>
        </div>
      </div>

      {/* USERS TABLE */}
      <div className="overflow-hidden rounded-2xl border border-[#d5ded8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#edf0eb] px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-[#0f2d3a]">
              {isSuperAdmin ? "All System Accounts" : "Your Staff Accounts"}
            </h3>
            <p className="mt-1 text-xs font-semibold text-[#3d635b]">
              {users.length} {users.length === 1 ? "account" : "accounts"} listed
            </p>
          </div>

          <span className="rounded-lg bg-[#dcefe5] px-3 py-1.5 text-xs font-bold text-[#0f5c54]">
            Role-enforced access
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm font-medium text-[#3d635b]">
            <RefreshCw className="mx-auto mb-2 animate-spin text-[#166b5e]" size={22} />
            Loading account records...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-sm font-medium text-[#3d635b]">
            {isSuperAdmin
              ? "No accounts found in the database."
              : "No staff accounts created yet. Click 'Add Staff' to create your first staff member."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#edf4ee]">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                    Full Name
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                    Email
                  </th>
                  {/* SUPER_ADMIN sees Role column; ADMIN view omits it */}
                  {isSuperAdmin && (
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                      Role
                    </th>
                  )}
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                    Account Status
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                    Creation Date
                  </th>
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#1c473f]">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf1ec]">
                {users.map((user) => {
                  const isCurrentSuperAdmin = isSuperAdmin && user.user_id === currentUser.user_id;
                  const isAnySuperAdmin = user.role === "SUPER_ADMIN";
                  const badgeInfo = roleBadge(user.role);

                  return (
                    <tr key={user.user_id} className="transition hover:bg-[#f9fbf8]">
                      {/* FULL NAME */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#0f2d3a]">
                            {user.full_name}
                          </span>
                          {isCurrentSuperAdmin && (
                            <span className="rounded-md bg-[#d8ece4] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0f5c54]">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      {/* EMAIL */}
                      <td className="px-6 py-4 text-sm font-medium text-[#133844]">
                        {user.email}
                      </td>

                      {/* ROLE (SUPER_ADMIN view only) */}
                      {isSuperAdmin && (
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeInfo.className}`}
                          >
                            {badgeInfo.label}
                          </span>
                        </td>
                      )}

                      {/* STATUS */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                            user.is_active
                              ? "border-[#bbf7d0] bg-[#dcfce7] text-[#14532d]"
                              : "border-[#fecaca] bg-[#fee2e2] text-[#991b1b]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.is_active ? "bg-[#14532d]" : "bg-[#991b1b]"
                            }`}
                          />
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* CREATION DATE */}
                      <td className="px-6 py-4 text-xs font-semibold text-[#3d635b]">
                        {new Date(user.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-4">
                        {isCurrentSuperAdmin || isAnySuperAdmin ? (
                          <span className="text-xs font-bold text-[#486b62]">
                            Protected
                          </span>
                        ) : (
                          <button
                            onClick={() => void handleToggleStatus(user)}
                            className={`rounded-lg border px-3.5 py-1.5 text-xs font-bold transition ${
                              user.is_active
                                ? "border-[#fca5a5] bg-white text-[#991b1b] hover:bg-[#fef2f2]"
                                : "border-[#86efac] bg-white text-[#166534] hover:bg-[#f0fdf4]"
                            }`}
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACCOUNT CREATION MODAL */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f2d3a]/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[#d5ded8] bg-[#fffefa] shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-[#e8eee8] p-6">
              <div>
                <h3 className="text-lg font-extrabold text-[#0f2d3a]">
                  {isSuperAdmin ? "Add New Administrator" : "Add New Staff Member"}
                </h3>
                <p className="mt-1 text-xs font-medium text-[#3d635b]">
                  {isSuperAdmin
                    ? "Provision an Admin account to manage operations and subordinate staff."
                    : "Provision a Staff account to execute vessel maintenance and report logs."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg p-2 text-[#2d524a] transition hover:bg-[#ebf3ee]"
              >
                <X size={19} />
              </button>
            </div>

            {/* MODAL FORM */}
            <form onSubmit={handleCreateUser} className="space-y-4 p-6">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-[#fca5a5] bg-[#fef2f2] p-3 text-xs font-semibold text-[#991b1b]">
                  <CircleAlert size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* AUTOMATIC ROLE DISPLAY */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#143c34]">
                  Assigned Role (Automatic)
                </label>
                <div className="flex items-center justify-between rounded-xl border border-[#cad8ce] bg-[#eef7f2] px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#146459]" />
                    <span className="text-sm font-bold text-[#0f2d3a]">
                      {isSuperAdmin ? "ADMIN" : "STAFF"}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#2d524a]">
                    {isSuperAdmin
                      ? "Automatically assigned by Super Admin"
                      : "Automatically assigned by Admin"}
                  </span>
                </div>
              </div>

              {/* FULL NAME */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#143c34]">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a6e65]"
                  />
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full rounded-xl border border-[#cad8ce] bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-[#0f2d3a] outline-none transition placeholder:text-[#64847c] focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#143c34]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a6e65]"
                  />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter work email address"
                    className="w-full rounded-xl border border-[#cad8ce] bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-[#0f2d3a] outline-none transition placeholder:text-[#64847c] focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#143c34]">
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a6e65]"
                  />
                  <input
                    required
                    minLength={8}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create account password"
                    className="w-full rounded-xl border border-[#cad8ce] bg-white py-2.5 pl-10 pr-11 text-sm font-medium text-[#0f2d3a] outline-none transition placeholder:text-[#64847c] focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3d635b] hover:text-[#0f2d3a]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#143c34]">
                  Confirm Password
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a6e65]"
                  />
                  <input
                    required
                    minLength={8}
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm account password"
                    className="w-full rounded-xl border border-[#cad8ce] bg-white py-2.5 pl-10 pr-11 text-sm font-medium text-[#0f2d3a] outline-none transition placeholder:text-[#64847c] focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3d635b] hover:text-[#0f2d3a]"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 border-t border-[#e8eee8] pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  className="rounded-xl border border-[#cbd9ce] px-5 py-2.5 text-sm font-semibold text-[#294c44] transition hover:bg-[#ebf4ef] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#186862] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#12534e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      {isSuperAdmin ? "Create Admin" : "Create Staff"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
