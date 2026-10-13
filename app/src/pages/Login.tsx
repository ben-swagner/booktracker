import { useState } from "react";
import { data } from "../data";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await data.signInWithEmail(email.trim());
      setSent(true);
    } catch (x: any) {
      setErr(x.message ?? "Das hat nicht geklappt.");
    }
  }

  return (
    <div className="wrap">
      <div className="login panel">
        <h1>Book<em>tracker</em></h1>
        <p className="lede">Melde dich an, dann wartet dein Regal auf dich.</p>
        {sent ? (
          <p>Wir haben dir einen Anmelde-Link an <strong>{email}</strong> geschickt. Öffne die Mail und tippe auf den Link.</p>
        ) : (
          <form onSubmit={send} className="section">
            <div className="field">
              <label htmlFor="email">E-Mail-Adresse</label>
              <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" />
            </div>
            {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
            <button className="btn primary" type="submit">Anmelde-Link schicken</button>
            <div className="actions">
              <button type="button" className="btn" onClick={() => data.signInWithProvider("google")}>Mit Google</button>
              <button type="button" className="btn" onClick={() => data.signInWithProvider("apple")}>Mit Apple</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
