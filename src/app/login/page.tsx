"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand" href="/login">
          <span className="brand-mark">
            p<span>+</span>
          </span>
          <span>
            PracticeChart
            <span className="brand-sub">ELECTRONIC HEALTH RECORDS</span>
          </span>
        </a>
        <div className="story-content">
          <span className="eyebrow">A CLEARER VIEW OF CARE</span>
          <h1>
            Every record.
            <br />
            One clear picture.
          </h1>
          <p>
            Keep the day moving. Find a patient, prepare a visit, and keep care
            records together.
          </p>
          <div className="record-illustration" aria-hidden="true">
            <div className="illustration-top">
              <span className="avatar">LC</span>
              <div>
                <strong>Lena Campbell</strong>
                <small>Fictional patient / PC-000001</small>
              </div>
              <ShieldCheck size={22} />
            </div>
            <div className="illustration-line">
              <span>Patient record</span>
              <span className="status">Available</span>
            </div>
            <div className="illustration-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="illustration-bottom">
              <span>Visit history</span>
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>
        <footer>
          Built for the practice. Designed around the patient.
          <span>CIT4001 course demonstration</span>
        </footer>
      </section>
      <section className="login-form-side">
        <div className="login-box">
          <span className="eyebrow">YOUR PRACTICE WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p className="muted">Log in to begin your day.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const form = new FormData(e.currentTarget);
              try {
                const r = await fetch("/api/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: form.get("username"),
                    password: form.get("password"),
                  }),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                window.location.href = "/app";
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Login is not available.",
                );
                setBusy(false);
              }
            }}
          >
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                required
                placeholder="Enter your username"
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? "Logging in..." : "Log in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="demo-login">
            <span className="demo-dot" />
            <strong>Explore the fictional practice</strong>
            <p>Use fictional data only. This is a course demo.</p>
            <div>
              <button
                onClick={() => {
                  const f = document.querySelector("form")!;
                  (f.elements.namedItem("username") as HTMLInputElement).value =
                    "doctor";
                  (f.elements.namedItem("password") as HTMLInputElement).value =
                    "DoctorDemo!2026";
                }}
              >
                Doctor account <ArrowUpRight size={14} />
              </button>
              <button
                onClick={() => {
                  const f = document.querySelector("form")!;
                  (f.elements.namedItem("username") as HTMLInputElement).value =
                    "frontdesk";
                  (f.elements.namedItem("password") as HTMLInputElement).value =
                    "DeskDemo!2026";
                }}
              >
                Front desk account <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          <p className="login-help">
            <ShieldCheck size={16} /> Your role controls which records you can
            use.
          </p>
        </div>
        <span className="login-copyright">
          PracticeChart EHR <span>Records with purpose.</span>
        </span>
      </section>
    </main>
  );
}
