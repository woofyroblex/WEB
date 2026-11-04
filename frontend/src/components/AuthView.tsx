import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";

export type AuthMode = "login" | "register";

type AuthViewProps = {
  mode: AuthMode;
  isBusy: boolean;
  error: string;
  onNavigate: (mode: AuthMode) => void;
  onSignIn: (username: string, password: string) => Promise<void>;
  onRegister: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
};

export default function AuthView({
  mode,
  isBusy,
  error,
  onNavigate,
  onSignIn,
  onRegister,
}: AuthViewProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const registering = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registering) {
      await onRegister(username.trim(), email.trim(), password);
    } else {
      await onSignIn(username.trim(), password);
    }
  }

  function followLink(event: MouseEvent<HTMLAnchorElement>, next: AuthMode) {
    event.preventDefault();
    onNavigate(next);
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About Project Hub">
        <a
          className="brand brand-light"
          href="/login"
          onClick={(event) => followLink(event, "login")}
        >
          <span className="brand-symbol">W</span>
          <span>Project Hub</span>
        </a>
        <div className="auth-story-copy">
          <span className="overline">A calmer way to work</span>
          <h1>Make progress visible.</h1>
          <p>
            Keep your projects moving with one clear view of priorities,
            ownership, and what is next.
          </p>
          <div className="story-note">
            <span className="story-note-icon" aria-hidden="true">
              ✓
            </span>
            <span>One workspace, with access tailored to your role.</span>
          </div>
        </div>
        <div className="auth-story-footer">
          PROJECT HUB <span>·</span> WORKSPACE
        </div>
      </section>

      <section className="auth-main">
        <div className="auth-card">
          <a
            className="brand brand-dark auth-mobile-brand"
            href="/login"
            onClick={(event) => followLink(event, "login")}
          >
            <span className="brand-symbol">W</span>
            <span>Project Hub</span>
          </a>
          <div className="auth-heading">
            <span className="overline">
              {registering ? "Get started" : "Welcome back"}
            </span>
            <h2>
              {registering ? "Create your account" : "Sign in to Project Hub"}
            </h2>
            <p>
              {registering
                ? "Set up your account to start managing your projects."
                : "Enter your details to open your workspace."}
            </p>
          </div>

          {error && (
            <div className="form-alert" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="username">
              Username
              <input
                id="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your username"
                required
              />
            </label>

            {registering && (
              <label className="field-label" htmlFor="email">
                Email address
                <input
                  id="email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
            )}

            <label className="field-label" htmlFor="password">
              Password
              <input
                id="password"
                autoComplete={registering ? "new-password" : "current-password"}
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  registering ? "At least 8 characters" : "Your password"
                }
                required
              />
            </label>

            <button
              className="button button-primary auth-submit"
              disabled={isBusy}
              type="submit"
            >
              {isBusy
                ? registering
                  ? "Creating account…"
                  : "Signing in…"
                : registering
                  ? "Create account"
                  : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            {registering ? "Already have an account?" : "New to Project Hub?"}{" "}
            {registering ? (
              <a href="/login" onClick={(event) => followLink(event, "login")}>
                Sign in
              </a>
            ) : (
              <a
                href="/register"
                onClick={(event) => followLink(event, "register")}
              >
                Create an account
              </a>
            )}
          </p>

          <p className="role-note">
            Account access is assigned by an administrator. New accounts start
            with the user role.
          </p>
        </div>
        <div className="auth-legal">
          Secure sign-in <span>·</span> Project Hub
        </div>
      </section>
    </main>
  );
}
