"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Stats = {
  monthly: { month: string; visits: string; filed: string }[];
  byRecord: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    visits: string;
  }[];
  states: { status: string; visits: string }[];
};
export function VisitPatterns() {
  const [data, setData] = useState<Stats>(),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/reports/visits?id=all", { signal: c.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <div style={{ marginTop: 24 }}>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <section className="panel" style={{ padding: 24 }}>
            <h3>Monthly visit pattern</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Visits</th>
                    <th>Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td>{m.visits}</td>
                      <td>{m.filed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {data.states.map((s) => `${s.status}: ${s.visits}`).join(" / ")}
            </p>
          </section>
          <section className="panel" style={{ padding: 24, marginTop: 24 }}>
            <h3>Visits by patient record</h3>
            <p>
              Each MRN keeps its visit count. Linked interim records remain
              separate here. No diagnoses are included.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Patient record</th>
                    <th>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byRecord.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={"/app/patients/" + p.id}>
                          {p.firstName} {p.lastName} / {p.mrn}
                        </Link>
                      </td>
                      <td>{p.visits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
