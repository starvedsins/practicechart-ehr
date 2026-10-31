"use client";
import { useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import { api, dateText, timeText, money } from "./workspace";
import type { ClinicalContent } from "@/lib/validation";
type Visit = {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  visitAt: string;
  doctorName: string;
  status: string;
};
type Revision = {
  visitId: string;
  content: ClinicalContent;
  state: string;
  revision: number;
  reason?: string;
  createdAt: string;
};
type Data = {
  patient?: {
    firstName: string;
    lastName: string;
    mrn: string;
    dob: string;
    address: string;
    phone: string;
  };
  visit?: Visit;
  visits?: Visit[];
  clinical?: Revision[] | Revision;
  documents?: { id: string; title: string; kind: string; createdAt: string }[];
  appointments?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    startAt: string;
    endAt: string;
    status: string;
    doctorName: string;
  }[];
  counts?: { day: string; visits: string; filed: string }[];
  invoice?: {
    number: string;
    firstName: string;
    lastName: string;
    mrn: string;
    address: string;
    createdAt: string;
    status: string;
    totalCents: number;
    lines: { description: string; quantity: number; unitCents: number }[];
  };
};
export default function PrintDocument({
  type,
  id,
}: {
  type: string;
  id: string;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Data>(`reports/${type}?id=${encodeURIComponent(id)}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [type, id]);
  const titles: Record<string, string> = {
    history: "Patient history report",
    prescription: "Prescription",
    certificate: "Medical certificate",
    summary: "Clinical visit summary",
    attendance: "Attendance slip",
    invoice: "Service invoice",
    schedule: "Appointment schedule",
    visits: "Visit logbook",
  };
  const clinical =
    data?.clinical && !Array.isArray(data.clinical) ? data.clinical : undefined;
  return (
    <main className="print-page">
      <div className="no-print action-row">
        <a href="/app" className="button">
          <ArrowLeft size={16} />
          Workspace
        </a>
        <button
          className="button primary"
          disabled={!data}
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Print or save PDF
        </button>
      </div>
      <header className="print-header">
        <span className="brand">PracticeChart EHR</span>
        <span className="muted">Fictional practice / Course demonstration</span>
      </header>
      <h1>{titles[type] || "Report"}</h1>
      <p className="muted">
        Prepared {dateText(new Date().toISOString())} at{" "}
        {timeText(new Date().toISOString())}, Jamaica time
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading report...</p>}
      {data?.patient && (
        <>
          <h2>
            {data.patient.firstName} {data.patient.lastName}
          </h2>
          <p>
            {data.patient.mrn} / Date of birth: {dateText(data.patient.dob)}
          </p>
          <p>
            {data.patient.address} / {data.patient.phone}
          </p>
        </>
      )}
      {data?.visit && (
        <>
          <h2>
            {data.visit.firstName} {data.visit.lastName}
          </h2>
          <p>Medical record: {data.visit.mrn}</p>
          <p>
            Visit: {dateText(data.visit.visitAt)} at{" "}
            {timeText(data.visit.visitAt)}
          </p>
          <p>Doctor: {data.visit.doctorName}</p>
          {type === "attendance" && (
            <p>
              Visit status: {data.visit.status}. This slip contains no
              diagnosis, treatment, or payment information.
            </p>
          )}
        </>
      )}
      {clinical && type === "summary" && (
        <>
          <h2>Reason for visit</h2>
          <p>{clinical.content.symptoms || "Not recorded"}</p>
          <p>
            Prescription issued:{" "}
            {clinical.content.medications.length ? "Yes" : "No"}
          </p>
          <p>Clinical revision: {clinical.revision}</p>
        </>
      )}
      {clinical && type === "prescription" && (
        <>
          <h2>Doctor-entered prescription</h2>
          {clinical.content.medications.length ? (
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Directions</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {clinical.content.medications.map((m, i) => (
                  <tr key={i}>
                    <td>{m.medication}</td>
                    <td>
                      {m.dosage}, {m.route}, {m.frequency}, {m.duration}
                      <br />
                      {m.instructions}
                    </td>
                    <td>{m.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No medication was entered for this visit.</p>
          )}
        </>
      )}
      {clinical && type === "certificate" && (
        <>
          <h2>Certificate text entered by the doctor</h2>
          <p>
            {clinical.content.certificate ||
              "No medical certificate was entered for this visit."}
          </p>
        </>
      )}
      {type === "history" && Array.isArray(data?.clinical) && (
        <>
          {data.clinical.length ? (
            data.clinical.map((c) => (
              <section key={c.visitId + c.revision} className="timeline-item">
                <h2>
                  {dateText(c.createdAt)} / Revision {c.revision} / {c.state}
                </h2>
                {c.reason && (
                  <p>
                    <strong>Correction or revision reason:</strong> {c.reason}
                  </p>
                )}
                {Object.entries(c.content)
                  .filter(([k, v]) => k !== "medications" && Boolean(v))
                  .map(([k, v]) => (
                    <p key={k}>
                      <strong>{k.replace(/([A-Z])/g, " $1")}:</strong>{" "}
                      {String(v)}
                    </p>
                  ))}
                {c.content.medications.map((m, i) => (
                  <p key={i}>
                    <strong>Medication:</strong> {m.medication}; {m.dosage};{" "}
                    {m.route}; {m.frequency}; {m.duration}; quantity{" "}
                    {m.quantity}. {m.instructions}
                  </p>
                ))}
              </section>
            ))
          ) : (
            <p>No clinical entries are recorded.</p>
          )}
          <h2>Diagnostic report index</h2>
          <p>
            Retrieve the original files through the private patient record. This
            index does not contain the file contents.
          </p>
          {data.documents?.map((d) => (
            <p key={d.id}>
              {d.title} / {d.kind} / {dateText(d.createdAt)}
            </p>
          ))}
        </>
      )}
      {data?.invoice && (
        <>
          <h2>
            {data.invoice.number} / {data.invoice.status}
          </h2>
          <p>
            {data.invoice.firstName} {data.invoice.lastName} /{" "}
            {data.invoice.mrn}
          </p>
          <p>{data.invoice.address}</p>
          <p>Invoice date: {dateText(data.invoice.createdAt)}</p>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Quantity</th>
                <th>Unit charge</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {data.invoice.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>{l.quantity}</td>
                  <td>{money(l.unitCents)}</td>
                  <td>{money(l.unitCents * l.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Total: {money(data.invoice.totalCents)}</h2>
          <p>Currency: JMD. This invoice is not proof of payment.</p>
        </>
      )}
      {data?.appointments && (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Medical record</th>
              <th>Doctor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.appointments.map((a) => (
              <tr key={a.id}>
                <td>
                  {timeText(a.startAt)} to {timeText(a.endAt)}
                </td>
                <td>
                  {a.firstName} {a.lastName}
                </td>
                <td>{a.mrn}</td>
                <td>{a.doctorName}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data?.counts && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Visits</th>
              <th>Filed visits</th>
            </tr>
          </thead>
          <tbody>
            {data.counts.map((c) => (
              <tr key={c.day}>
                <td>{dateText(c.day)}</td>
                <td>{c.visits}</td>
                <td>{c.filed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="print-note">
        Fictional data only. This course output is not a clinical approval or a
        signed medical document. A patient report is not a database backup.
      </p>
    </main>
  );
}
