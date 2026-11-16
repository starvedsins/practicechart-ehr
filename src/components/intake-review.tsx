"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Intake = {
  id: string;
  version: number;
  payload: Record<string, string | boolean>;
  createdAt: string;
};
type Match = { id: string; mrn: string; firstName: string; lastName: string };
async function request(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "The request failed.");
  return d;
}
export function IntakeReview() {
  const [items, setItems] = useState<Intake[]>([]),
    [error, setError] = useState("");
  const [matches, setMatches] = useState<Record<string, Match[]>>({});
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setItems(await request("intakes"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function review(item: Intake, action: string, form: FormData) {
    setError("");
    setBusy(true);
    try {
      if (action === "accept") {
        const found: Match[] = await request(
          "patients/check-duplicates",
          item.payload,
        );
        setMatches((v) => ({ ...v, [item.id]: found }));
        if (found.length && !form.get("duplicateReason"))
          throw new Error(
            "Review matching records. Enter a reason only if this is a separate patient.",
          );
      }
      await request("intakes/" + item.id, {
        action,
        version: item.version,
        reason: String(form.get("reason") || ""),
        duplicateReason: String(form.get("duplicateReason") || ""),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <p className="note-box">
        Patients complete the public{" "}
        <Link href="/register">registration form</Link>. Review their details
        before creating a patient record. A pending form has no MRN.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items.length && <p>No forms need review.</p>}
      {items.map((item) => (
        <article
          className="panel"
          key={item.id}
          style={{ marginBottom: 24, padding: 24 }}
        >
          <h2>
            {item.payload.firstName} {item.payload.lastName}
          </h2>
          <dl>
            {Object.entries(item.payload)
              .filter(([k, v]) => v !== "" && k !== "provisionalReason")
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
          </dl>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const action =
                (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                  "value",
                ) || "accept";
              void review(item, action, new FormData(e.currentTarget));
            }}
          >
            {(matches[item.id] || []).length > 0 && (
              <div className="note-box">
                <strong>Possible matches</strong>
                {matches[item.id].map((m) => (
                  <p key={m.id}>
                    <Link href={"/app/patients/" + m.id}>
                      {m.firstName} {m.lastName} / {m.mrn}
                    </Link>
                  </p>
                ))}
                <label>
                  Reason for a separate record
                  <textarea name="duplicateReason" maxLength={500} />
                </label>
              </div>
            )}
            <label>
              Review note or rejection reason
              <textarea name="reason" maxLength={500} />
            </label>
            <div className="action-row">
              <button
                className="button primary"
                name="action"
                value="accept"
                disabled={busy}
              >
                Accept and register
              </button>
              <button
                className="button"
                name="action"
                value="reject"
                disabled={busy}
              >
                Reject form
              </button>
            </div>
          </form>
        </article>
      ))}
    </section>
  );
}
