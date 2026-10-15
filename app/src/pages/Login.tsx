import { useState } from "react";
import { data } from "../data";

type Mode = "passwort" | "link";

export default function Login() {
  const [mode, setMode] = useState<Mode>("passwort");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function readable(msg: string) {
    if (/rate limit/i.test(msg)) return "Supabase verschickt im Moment nur wenige Mails pro Stunde. Bitte in einer Stunde noch einmal versuchen oder mit Passwort anmelden.";
    if (/invalid login credentials/i.test(msg)) return "E-Mail oder Passwort stimmen nicht.";
    if (/email not confirmed/i.test(msg)) return "Die E-Mail-Adresse ist noch nicht bestätigt. Bitte den Link aus der Mail öffnen.";
    return msg;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "link") {
        await data.signInWithEmail(email.trim());
        setSent(true);
      } else {
        await data.signInWithPassword(email.trim(), password);
      }
    } catch (x: any) {
      setErr(readable(x.message ?? "Das hat nicht geklappt."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="login panel">
        <h1>Booktracker</h1>
        <p className="lede">Melde dich an, dann wartet dein Regal auf dich.</p>
        <div className="tabs" role="tablist" style={{ alignSelf: "flex-start" }}>
          <button type="button" className="tab" role="tab" aria-selected={mode === "passwort"} onClick={() => { setMode("passwort"); setErr(null); }}>Mit Passwort</button>
          <button type="button" className="tab" role="tab" aria-selected={mode === "link"} onClick={() => { setMode("link"); setErr(null); }}>Mit Mail-Link</button>
        </div>
        {sent ? (
          <p>Wir haben dir einen Anmelde-Link an <strong>{email}</strong> geschickt. Öffne die Mail und tippe auf den Link.</p>
        ) : (
          <form onSubmit={submit} className="section">
            <div className="field">
              <label htmlFor="email">E-Mail-Adresse</label>
              <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" />
            </div>
            {mode === "passwort" && (
              <div className="field">
                <label htmlFor="password">Passwort</label>
                <input id="password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {err && <p style={{ color: "var(--danger)", margin: 0 }}>{err}</p>}
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Einen Moment…" : mode === "link" ? "Anmelde-Link schicken" : "Anmelden"}
            </button>
            {mode === "passwort" && (
              <p className="meta">Noch kein Passwort? Melde dich einmal mit dem Mail-Link an und lege es dann unter „Mehr“ fest.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
