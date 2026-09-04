import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalAuth } from "../../context/PortalAuthContext";
import logo from "../../assets/logo.png";

export function PortalLogin() {
  const { login } = usePortalAuth();
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(employeeCode, password);
      navigate("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <img src={logo} alt="Himalayan Inc" className="login-logo" />
        <h1>My Payslips</h1>
        <p className="muted">Employee login</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label>
          Employee Code
          <input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} required autoFocus placeholder="e.g. 1909" />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
        </label>

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted small" style={{ marginTop: 12 }}>
          Don't have a password yet? Ask your admin to enable portal access for you.
        </p>
      </form>
    </div>
  );
}
