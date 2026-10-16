"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getApiErrorMessage, signIn, type AuthUser } from "../lib/api";

type LoginFormProps = {
  onAuthenticated: (user: AuthUser) => void;
};

export default function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await signIn(email, password);
      if (!response?.user) {
        throw new Error("Сервер не вернул вошедшего пользователя");
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
      <header className="auth-header">
        <div className="brand-lockup auth-brand" aria-label="Планировка">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <div><strong>Планировка</strong></div>
        </div>
      </header>

      <section className="auth-form-panel" aria-labelledby="login-title">
        <div className="auth-heading">
          <h1 id="login-title">С возвращением</h1>
          <p>Войдите в рабочее пространство</p>
        </div>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="auth-field">
            <span>Электронная почта</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className="auth-field">
            <span>Пароль</span>
            <span className="auth-password-field">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
              />
              <button
                className="auth-password-toggle"
                type="button"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={showPassword}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </span>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Входим…" : "Войти"}
          </button>
        </form>
        <p className="auth-footnote">Доступ выдаёт администратор</p>
      </section>
    </main>
  );
}
