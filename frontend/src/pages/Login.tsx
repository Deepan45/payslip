import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

const FEATURES: { icon: string; label: string }[] = [
  { icon: "M12 16V4M12 4l-4 4M12 4l4 4M4 20h16", label: "Upload salary sheets for any client site" },
  { icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8", label: "Auto-generate professional payslips" },
  { icon: "M3 3v18h18M8 17V10M13 17V6M18 17v-4", label: "Track payroll cost & advances across sites" },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-brand-panel">
        <div className="auth-brand-glow" />
        <div className="auth-brand-content">
          <img src={logo} alt="Himalayan Inc" className="auth-brand-logo" />
          <h1 className="auth-brand-title">Himalayan Payroll</h1>
          <p className="auth-brand-tagline">One system for every client site, employee, and payslip.</p>

          <ul className="auth-feature-list">
            {FEATURES.map((f) => (
              <li key={f.label}>
                <span className="auth-feature-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <img src={logo} alt="Himalayan Inc" className="auth-form-logo" />
          <h2 className="auth-form-title">Admin Sign In</h2>
          <p className="muted small" style={{ marginBottom: 24 }}>
            Enter your credentials to access the payroll dashboard.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@company.com" />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </label>

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="muted small" style={{ marginTop: 20, textAlign: "center" }}>
            Trouble signing in? Contact your system administrator.
          </p>
        </form>
      </div>
    </div>
  );
}
