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
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-lockup auth-brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <div><strong>Планировщик магазинов</strong><span>Рабочее пространство Vizaje-Nica</span></div>
        </div>
        <span className="eyebrow">Закрытое рабочее пространство</span>
        <h1 id="login-title">С возвращением.</h1>
        <p className="auth-intro">Войдите с помощью аккаунта, созданного для вашей команды.</p>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="modal-field">
            <span>Электронная почта</span>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="modal-field">
            <span>Пароль</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Вход…" : "Войти"}
          </button>
        </form>
        <p className="auth-footnote">Доступ управляется внутри команды. Публичной регистрации нет.</p>
      </section>
    </main>
  );
}
