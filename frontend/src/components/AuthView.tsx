import { useState } from "react";
import type { FormEvent } from "react";
import type { WorkspaceConfig } from "../types";

type AuthViewProps = {
  onSignIn: (username: string, password: string) => Promise<void>;
  onRegister: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  onEnterDemoMode: () => void;
  isBusy: boolean;
  error: string;
  message: string;
  config: WorkspaceConfig;
};

export default function AuthView({
  onSignIn,
  onRegister,
  onEnterDemoMode,
  isBusy,
  error,
  message,
  config,
}: AuthViewProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isRegistering) {
      await onRegister(username, email, password);
    } else {
      await onSignIn(username, password);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-lockup">
          <span className="brand-mark">W</span>
          <span className="brand-name">
            WEB<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="auth-intro">
          <span className="eyebrow">CLEAN & ADAPTIVE PLATFORM</span>
          <h1>{isRegistering ? "Create your workspace" : "Welcome back"}</h1>
          <p>
            {config.tagline ||
              "Keep work moving and see what your team is building."}
          </p>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="form-success" role="status">
            {message}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rijin"
              required
            />
          </label>

          {isRegistering && (
            <label>
              Email address
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>
          )}

          <label>
            Password
            <input
              autoComplete={isRegistering ? "new-password" : "current-password"}
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <button
            className="button button-primary button-wide"
            disabled={isBusy}
            type="submit"
          >
            {isBusy
              ? "Please wait…"
              : isRegistering
                ? "Create Workspace"
                : "Sign In with API"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <button
          className="button button-demo button-wide"
          onClick={onEnterDemoMode}
          type="button"
          title="Instant access with interactive sample data"
        >
          <span>⚡</span> Explore Instant Demo / Guest Mode
        </button>

        <p className="auth-switch">
          {isRegistering ? "Already have an account?" : "Need a new account?"}
          <button
            className="text-button"
            onClick={() => setIsRegistering((curr) => !curr)}
            type="button"
          >
            {isRegistering ? "Sign in" : "Create one"}
          </button>
        </p>

        <div className="auth-footnote">
          <span>Private workspace</span>
          <span>·</span>
          <span>Adaptive domain support</span>
        </div>
      </section>

      <aside className="auth-aside">
        <div className="aside-orbit orbit-one" />
        <div className="aside-orbit orbit-two" />
        <div className="aside-content">
          <span className="eyebrow">ZERO-SETUP FLEXIBLE STACK</span>
          <h2>Ready for any problem statement.</h2>
          <p>
            Clean architecture built to pivot smoothly across hackathons,
            business tools, data pipelines, and full-stack products.
          </p>
          <div className="aside-features">
            <div className="aside-feature-item">
              <span className="aside-check">✓</span>
              <span>Kanban Board & Tabular Data Grid</span>
            </div>
            <div className="aside-feature-item">
              <span className="aside-check">✓</span>
              <span>Real-time Search & Priority Filters</span>
            </div>
            <div className="aside-feature-item">
              <span className="aside-check">✓</span>
              <span>1-Click Domain Customization & Dark Mode</span>
            </div>
          </div>
          <div className="aside-note">
            <span className="note-dot" />
            Django REST API + Local-first hybrid fallback
          </div>
        </div>
        <span className="aside-index">WEB · FLEXIBLE PLATFORM</span>
      </aside>
    </main>
  );
}
