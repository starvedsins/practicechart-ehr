"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { demoIntake } from "@/lib/demo-intake";

export default function PatientRegistration({
  demo = false,
}: {
  demo?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const reference = useRef("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    reference.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/public-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(data),
          submissionId: reference.current,
          consent: data.get("consent") === "on",
          emailOptIn: data.get("emailOptIn") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "The form could not be sent.");
      setSent(result.reference);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The service is not available. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ maxWidth: 680, margin: "40px auto", padding: 24 }}>
      <Link href="/login" className="text-button">
        PracticeChart / Staff login
      </Link>
      <h1>Patient registration</h1>
      <p className="note-box">
        Course demonstration. Use fictional details only. This form does not
        book an appointment. Reception will review your details.
      </p>
      {sent ? (
        <section role="status">
          <h2>Form received</h2>
          <p>
            Keep this reference: <strong>{sent}</strong>
          </p>
          <p>
            Reception will check your form. No patient record or appointment is
            confirmed yet.
          </p>
          <Link href="/login">Return to login</Link>
        </section>
      ) : (
        <form ref={form} onSubmit={submit} className="panel-body">
          {demo && (
            <p className="note-box">
              The public demo accepts only this fictional example.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  for (const [key, value] of Object.entries(demoIntake)) {
                    const field = form.current?.elements.namedItem(key);
                    if (
                      field instanceof HTMLInputElement ||
                      field instanceof HTMLSelectElement
                    )
                      field.value = value;
                  }
                }}
              >
                Use fictional example
              </button>
            </p>
          )}
          <div className="form-grid">
            <label>
              First name
              <input
                name="firstName"
                required
                maxLength={80}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                required
                maxLength={80}
                autoComplete="family-name"
              />
            </label>
            <label>
              Date of birth
              <input
                name="dob"
                type="date"
                max={new Intl.DateTimeFormat("en-CA", {
                  timeZone: "America/Jamaica",
                }).format(new Date())}
                required
                autoComplete="bday"
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                type="tel"
                required
                minLength={7}
                maxLength={30}
                autoComplete="tel"
              />
            </label>
            <label className="full">
              Address
              <input
                name="address"
                required
                maxLength={300}
                autoComplete="street-address"
              />
            </label>
            <label>
              Email (optional)
              <input
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
              />
            </label>
            <label>
              Gender
              <select name="gender">
                <option>Not stated</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </label>
            <label className="full">
              Emergency contact (optional)
              <input name="emergencyContact" maxLength={200} />
            </label>
            <label className="full">
              Insurance reference (optional)
              <input name="insurance" maxLength={100} />
            </label>
          </div>
          <div hidden aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="check-row">
            <input name="emailOptIn" type="checkbox" /> Send appointment
            confirmations and reminders by email. Demo mail goes to a test
            inbox.
          </label>
          <label className="check-row">
            <input name="consent" type="checkbox" required /> I agree that
            reception can review these details for registration.
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Sending..." : "Send registration form"}
          </button>
        </form>
      )}
    </main>
  );
}
