import { useState, type FormEvent } from "react";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Ship,
  Waves,
  ShieldCheck,
  Info,
} from "lucide-react";

import {
  login,
  fetchCurrentUser,
  logout,
  type User as AuthUser,
} from "./api";

interface AuthPagesProps {
  onLoginSuccess: (user: AuthUser) => void;
}

type AuthMode = "login" | "splash" | "info";

export default function AuthPages({
  onLoginSuccess,
}: AuthPagesProps) {
  const [mode, setMode] = useState<AuthMode>("login");

  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const changeMode = (nextMode: AuthMode) => {
    resetMessages();
    setMode(nextMode);
  };

  // ---------------- ROLE DISPLAY ----------------

  const getRoleName = (role: AuthUser["role"]) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "Super Administrator";
      case "ADMIN":
        return "Administrator";
      case "STAFF":
        return "Staff Member";
      default:
        return "User";
    }
  };

  // ---------------- LOGIN ----------------

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setIsLoading(true);

      // Step 1: Authenticate with backend and save token.
      await login(trimmedEmail, password);

      // Step 2: Retrieve authenticated user details (/auth/me).
      const user = await fetchCurrentUser();

      if (!user.is_active) {
        logout();
        setError("Your account is inactive. Please contact your administrator.");
        return;
      }

      // Step 3: Save authenticated user session information.
      sessionStorage.setItem("shipmem_user", JSON.stringify(user));
      sessionStorage.setItem("shipmem_user_role", user.role);

      setMessage(`Authenticated as ${user.full_name} (${getRoleName(user.role)})`);

      // Step 4: Notify parent application to transition to dashboard.
      onLoginSuccess(user);
    } catch (err) {
      logout();
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- STYLING ----------------

  const inputClass =
    "w-full rounded-xl border border-[#cad8ce] bg-white py-3 pl-11 pr-4 text-sm font-medium text-[#0f2d3a] outline-none transition placeholder:text-[#64847c] focus:border-[#1e7a6e] focus:ring-2 focus:ring-[#d0ece1]";

  const labelClass = "mb-2 block text-sm font-bold text-[#143c34]";

  // ---------------- UI ----------------

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f8f4] px-5 py-10 text-[#0f2d3a]">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#dcebe3] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-28 h-96 w-96 rounded-full bg-[#e8eee5] opacity-80 blur-3xl" />

      <div className="relative z-10 w-full max-w-5xl">
        {mode === "splash" ? (
          /* ---------------- SPLASH PAGE ---------------- */
          <section className="grid overflow-hidden rounded-[2rem] border border-[#d5ded8] bg-white shadow-[0_24px_80px_rgba(41,75,64,0.09)] md:grid-cols-2">
            <div className="flex flex-col justify-between bg-[#eaf2ec] p-8 md:p-12">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#186862] text-white shadow-lg">
                  <Anchor size={28} />
                </div>

                <p className="mt-8 text-xs font-bold uppercase tracking-[0.25em] text-[#246359]">
                  Smart Maritime Operations
                </p>

                <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-[#0f2d3a] md:text-5xl">
                  SHIP
                  <span className="text-[#186862]">MEM</span>
                </h1>

                <p className="mt-5 max-w-md text-base font-medium leading-7 text-[#264d45]">
                  Smart Vessel Maintenance and Operational Memory System.
                  Keep vessel records, maintenance activities, repairs, and
                  operational insights securely organized in one place.
                </p>
              </div>

              <div className="mt-12 flex items-center gap-3 text-sm font-bold text-[#1f4740]">
                <Waves size={20} />
                <span>Smarter records. Better vessel management.</span>
              </div>
            </div>

            <div className="flex flex-col justify-center p-8 md:p-12">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#dcefe5] text-[#146459]">
                <Ship size={32} />
              </div>

              <p className="text-sm font-bold text-[#146459]">
                Welcome aboard
              </p>

              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0f2d3a]">
                Your operations,
                <br />
                all in one place.
              </h2>

              <p className="mt-4 text-sm font-medium leading-6 text-[#2d4d46]">
                Sign in with your email and password to access your maritime
                workspace. Your available operations and administrative controls
                are automatically determined by your authenticated role.
              </p>

              <div className="mt-9 space-y-3">
                <button
                  type="button"
                  onClick={() => changeMode("login")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#186862] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#12534e]"
                >
                  Sign In to Workspace
                  <ArrowRight size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => changeMode("info")}
                  className="w-full rounded-xl border border-[#cad8ce] bg-white px-5 py-3.5 text-sm font-bold text-[#185e54] transition hover:bg-[#eef5f1]"
                >
                  Account Access Information
                </button>
              </div>

              <p className="mt-8 text-center text-xs font-bold text-[#3d635b]">
                SHIPMEM · Secure Maritime Operating System
              </p>
            </div>
          </section>
        ) : mode === "info" ? (
          /* ---------------- ACCESS INFORMATION ---------------- */
          <section className="mx-auto max-w-lg rounded-[2rem] border border-[#d5ded8] bg-white p-8 shadow-[0_24px_80px_rgba(41,75,64,0.09)] md:p-10">
            <button
              type="button"
              onClick={() => changeMode("login")}
              className="mb-8 flex items-center gap-2 text-sm font-bold text-[#2d524a] transition hover:text-[#0f2d3a]"
            >
              <ArrowLeft size={17} />
              Back to Sign In
            </button>

            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcefe5] text-[#146459]">
              <ShieldCheck size={28} />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#246359]">
              Security & Access Policy
            </p>

            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0f2d3a]">
              Managed Account Access
            </h1>

            <p className="mt-3 text-sm font-medium leading-relaxed text-[#264842]">
              SHIPMEM is a secure vessel maintenance platform. Public self-registration is disabled. All user accounts are created and managed by authorized system administrators:
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-[#cad8ce] bg-[#eef7f2] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0f5c54]">
                  Super Administrator
                </p>
                <p className="mt-1 text-xs font-medium text-[#264842]">
                  Provisions and manages Administrator accounts and platform-wide configurations.
                </p>
              </div>

              <div className="rounded-xl border border-[#cad8ce] bg-[#eef7f2] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0f5c54]">
                  Administrator
                </p>
                <p className="mt-1 text-xs font-medium text-[#264842]">
                  Provisions and manages Staff member accounts assigned to their operations.
                </p>
              </div>

              <div className="rounded-xl border border-[#cad8ce] bg-[#eef7f2] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0f5c54]">
                  Staff Member
                </p>
                <p className="mt-1 text-xs font-medium text-[#264842]">
                  Executes vessel maintenance records, logs incidents, and conducts inspections.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => changeMode("login")}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#186862] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#12534e]"
              >
                Return to Sign In
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
        ) : (
          /* ---------------- LOGIN PAGE ---------------- */
          <section className="mx-auto max-w-md rounded-[2rem] border border-[#d5ded8] bg-white p-8 shadow-[0_24px_80px_rgba(41,75,64,0.09)] md:p-10">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeMode("splash")}
                className="flex items-center gap-1.5 text-xs font-bold text-[#2d524a] transition hover:text-[#0f2d3a]"
              >
                <ArrowLeft size={15} />
                About SHIPMEM
              </button>
              <div className="flex items-center gap-1 text-xs font-bold text-[#185e54]">
                <ShieldCheck size={14} className="text-[#146459]" />
                Secure Portal
              </div>
            </div>

            <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcefe5] text-[#146459]">
              <Anchor size={27} />
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-[#246359]">
              SHIPMEM
            </p>

            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0f2d3a]">
              Welcome back
            </h1>

            <p className="mt-2 text-sm font-medium leading-6 text-[#2d4d46]">
              Sign in to continue to your vessel management workspace.
            </p>

            {/* ---------------- FORM ---------------- */}

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              {/* EMAIL */}
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a6e65]"
                  />

                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#4a6e65]"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${inputClass} pr-12`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4a6e65] hover:text-[#0f2d3a]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* ERROR MESSAGE */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#991b1b]"
                >
                  {error}
                </div>
              )}

              {/* SUCCESS MESSAGE */}
              {message && (
                <div
                  role="status"
                  className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold leading-6 text-[#14532d]"
                >
                  {message}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#186862] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#12534e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign In"}
                {!isLoading && <ArrowRight size={17} />}
              </button>
            </form>

            {/* ---------------- ACCESS NOTICE ---------------- */}
            <div className="mt-7 rounded-xl border border-[#cad8ce] bg-[#eef7f2] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0f5c54]">
                <Info size={15} />
                Role-Governed Access
              </div>
              <p className="mt-1 text-xs font-medium leading-relaxed text-[#264842]">
                Your role and workspace permissions are automatically determined upon sign-in. For new accounts, contact your assigned administrator.
              </p>
            </div>

            {/* ---------------- FOOTER ---------------- */}
            <div className="mt-7 border-t border-[#edf1ed] pt-5 text-center">
              <p className="text-xs font-medium text-[#2d4d46]">
                Need an account or assistance?{" "}
                <button
                  type="button"
                  onClick={() => changeMode("info")}
                  className="font-bold text-[#185e54] hover:text-[#0f2d3a]"
                >
                  Access details
                </button>
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
