import React from "react";

/** Fängt Fehler einer Seite ab, damit die App nicht komplett verschwindet. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Booktracker-Fehler", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="panel section">
          <h2>Da ist etwas schiefgelaufen</h2>
          <p className="muted">Die Seite konnte nicht angezeigt werden. Technische Meldung:</p>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{String(this.state.error?.stack ?? this.state.error)}</pre>
          <div className="actions"><button className="btn" onClick={() => this.setState({ error: null })}>Noch einmal versuchen</button></div>
        </div>
      );
    }
    return this.props.children;
  }
}
