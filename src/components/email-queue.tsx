"use client";
import { useState, useEffect } from "react";
type Mail = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  lastError: string;
  mrn: string;
  firstName: string;
  lastName: string;
  startAt: string;
};
export function EmailQueue() {
  const [items, setItems] = useState<Mail[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setItems(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section>
      <p className="note-box">
        Only patients who gave email consent can receive mail. In the public
        demo, all mail goes to a provider test inbox. Sent means the provider
        accepted the message. It does not prove inbox delivery.
      </p>
      <button className="button" onClick={() => void load()}>
        Refresh status
      </button>
      <button
        className="button"
        onClick={async () => {
          try {
            const r = await fetch("/api/notifications/retry", {
              method: "POST",
            });
            if (!r.ok) throw new Error("The worker could not be started.");
            setError("Worker started. Refresh status in a moment.");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Retry due email
      </button>
      {error && <p role="status">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Type</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.firstName} {m.lastName}
                  <small>{m.mrn}</small>
                </td>
                <td>{m.kind}</td>
                <td>{m.status}</td>
                <td>{m.attempts}</td>
                <td>{m.lastError || "No error recorded"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
