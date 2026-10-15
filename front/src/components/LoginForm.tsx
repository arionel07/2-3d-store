"use client";

import { useState, type FormEvent } from "react";
import { getApiErrorMessage, signIn, type AuthUser } from "../lib/api";

type LoginFormProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export default function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await signIn(email, password);
      if (!response?.user) {
        throw new Error("The server did not return an authenticated user");
      }
      onAuthenticated(response.user);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-lockup auth-brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <div><strong>Store Layout Planner</strong><span>Vizaje-Nica workspace</span></div>
        </div>
        <span className="eyebrow">Private workspace</span>
        <h1 id="login-title">Welcome back.</h1>
        <p className="auth-intro">Sign in with the account created for your team.</p>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="modal-field">
            <span>Email</span>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="modal-field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-footnote">Access is managed internally. There is no public sign-up.</p>
      </section>
    </main>
  );
}
