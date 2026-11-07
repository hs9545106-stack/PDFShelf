
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Mail, ArrowRight } from "lucide-react";
import { supabase } from "./lib/supabase-client";
import "./assets/AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) throw loginError;

      if (!data.user) {
        throw new Error("Unable to verify your account.");
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (adminError) throw adminError;

      if (
        !admin ||
        !admin.is_active ||
        !["owner", "admin"].includes(admin.role)
      ) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-login-logo">P</div>
          <span>PDFShelf</span>
        </div>

        <div className="admin-login-heading">
          <div className="admin-login-lock">
            <LockKeyhole size={22} />
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to your PDFShelf administration panel.</p>
        </div>

        <form onSubmit={handleLogin}>
          <label htmlFor="admin-email">Email address</label>
          <div className="admin-login-input">
            <Mail size={18} />
            <input
              id="admin-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <label htmlFor="admin-password">Password</label>
          <div className="admin-login-input">
            <LockKeyhole size={18} />
            <input
              id="admin-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="admin-login-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="admin-login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in to dashboard"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="admin-login-footer">
          Restricted access · Authorised administrators only
        </p>
      </section>
    </main>
  );
}
