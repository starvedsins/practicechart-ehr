"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Files,
  ChartNoAxesCombined,
  ReceiptText,
  Settings2,
  ShieldCheck,
  LogOut,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Clock3,
  Check,
  FileText,
  X,
  MoreHorizontal,
  ClipboardList,
  Printer,
  CalendarPlus,
  UserPlus,
  Stethoscope,
  FolderOpen,
  Activity,
  Download,
  LockKeyhole,
} from "lucide-react";
import type { Staff } from "@/lib/schema";
import { emptyClinical, type ClinicalContent } from "@/lib/validation";
type Patient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  address: string;
  gender: string;
  emergencyContact?: string;
  insurance?: string;
  provisionalReason: string;
  mergedInto?: string;
  archived: boolean;
  version: number;
};
type Doctor = { id: string; name: string };
type Appointment = {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: string;
  version: number;
  firstName?: string;
  lastName?: string;
  mrn?: string;
  doctorName: string;
};
type Visit = {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  revision: number;
  visitAt: string;
  filedAt?: string;
  doctorName: string;
};
type Revision = {
  id: string;
  visitId: string;
  revision: number;
  authorName: string;
  state: string;
  reason: string;
  content: ClinicalContent;
  createdAt: string;
};
type Doc = {
  id: string;
  patientId: string;
  title: string;
  kind: string;
  mime: string;
  size: number;
  createdAt: string;
  replacesId?: string;
  firstName?: string;
  lastName?: string;
  mrn?: string;
};
type Invoice = {
  id: string;
  number: string;
  patientId: string;
  lines: { description: string; quantity: number; unitCents: number }[];
  totalCents: number;
  status: string;
  version: number;
  firstName: string;
  lastName: string;
  createdAt: string;
};
type Account = Staff & { active: boolean };
type Audit = {
  id: string;
  actorName?: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};
type Detail = {
  patient: Patient;
  visits: Visit[];
  appointments: Appointment[];
  clinical?: Revision[];
  documents?: Doc[];
};
type Dashboard = {
  counts: {
    patients: string;
    appointments: string;
    ready: string;
    filed: string;
  };
  ready: (Visit & Patient & { patientId: string })[];
  reminders: (Appointment & Patient)[];
};
type Hours = {
  hours: {
    doctorId: string;
    doctorName: string;
    weekday: number;
    startMin: number;
    endMin: number;
  }[];
  blocks: { id: string; doctorName: string; startAt: string; endAt: string }[];
};
type Trend = { day: string; visits: string; filed: string };
type Modal = {
  kind: string;
  replacesId?: string;
  patient?: Patient;
  appointment?: Appointment;
  invoice?: Invoice;
  account?: Account;
};
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : method,
    signal,
    headers:
      body instanceof FormData
        ? {}
        : body === undefined
          ? {}
          : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const d = await r.json();
  if (r.status === 401) {
    window.location.href = "/login";
    throw Error("Please log in.");
  }
  if (!r.ok) throw Error(d.error || "The request failed.");
  return d as T;
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica" }).format(
    new Date(),
  );
export const dateText = (
  date: string,
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) =>
  new Intl.DateTimeFormat("en-JM", {
    timeZone: "America/Jamaica",
    ...opts,
  }).format(new Date(date.length === 10 ? date + "T12:00:00Z" : date));
export const timeText = (date: string) =>
  dateText(date, { hour: "numeric", minute: "2-digit" });
export const money = (n: number) =>
  new Intl.NumberFormat("en-JM", { style: "currency", currency: "JMD" }).format(
    n / 100,
  );
const initials = (p: { firstName: string; lastName: string }) =>
  (p.firstName[0] + p.lastName[0]).toUpperCase();
function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value}>{value.replaceAll("_", " ")}</span>
  );
}
function Person({
  patient,
  sub,
}: {
  patient: Pick<Patient, "firstName" | "lastName">;
  sub?: string;
}) {
  return (
    <div className="person">
      <span className="avatar" aria-hidden="true">
        {initials(patient)}
      </span>
      <span>
        <strong>
          {patient.firstName} {patient.lastName}
        </strong>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}
function Empty({
  title = "Nothing here yet.",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={24} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
function PrintLink({
  type,
  id,
  label = "Print",
}: {
  type: string;
  id: string;
  label?: string;
}) {
  return (
    <a
      className="button"
      target="_blank"
      rel="noopener"
      href={`/print/${type}?id=${encodeURIComponent(id)}`}
    >
      <Printer size={14} />
      {label}
    </a>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Close form" onClick={close}>
          <X size={18} />
        </button>
      </div>
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}
function Form({
  children,
  submit,
  label = "Save",
  secondary,
}: {
  children: ReactNode;
  submit: (d: FormData) => Promise<void>;
  label?: string;
  secondary?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await submit(new FormData(e.currentTarget));
        } catch (err) {
          setError(err instanceof Error ? err.message : "The save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        {secondary}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving..." : label}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
const field = (d: FormData, k: string) => String(d.get(k) || "");
function PatientSelect({
  patients,
  selected,
  selectedId,
  name = "patientId",
  label = "Patient",
  excludeId,
  includeArchived = false,
  onChange,
  onSelect,
}: {
  patients: Patient[];
  selected?: Patient;
  selectedId?: string;
  name?: string;
  label?: string;
  excludeId?: string;
  includeArchived?: boolean;
  onChange?: (id: string) => void;
  onSelect?: (patient: Patient | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Patient[]>(patients);
  const [chosen, setChosen] = useState<Patient | undefined>(
    selected || patients.find((p) => p.id === selectedId),
  );
  const [value, setValue] = useState(selected?.id || selectedId || "");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      api<Patient[]>(
        "patients?q=" + encodeURIComponent(query),
        undefined,
        "GET",
        controller.signal,
      )
        .then(setMatches)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    if (!selectedId || chosen) return;
    const controller = new AbortController();
    api<Detail>("patients/" + selectedId, undefined, "GET", controller.signal)
      .then((d) => {
        setChosen(d.patient);
        onSelect?.(d.patient);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [selectedId, chosen, onSelect]);
  const options =
    chosen && !matches.some((p) => p.id === chosen.id)
      ? [chosen, ...matches]
      : matches;
  return (
    <>
      <label>
        Find patient by name or MRN
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setError("");
            setQuery(e.target.value);
          }}
          placeholder="Search all patient records"
        />
      </label>
      <label>
        {label}
        <select
          aria-label={label}
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChosen(options.find((p) => p.id === e.target.value));
            onSelect?.(options.find((p) => p.id === e.target.value));
            onChange?.(e.target.value);
          }}
          required
        >
          <option value="" disabled>
            Choose a patient
          </option>
          {options
            .filter(
              (p) => (includeArchived || !p.archived) && p.id !== excludeId,
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} / {p.mrn}
              </option>
            ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
function PatientForm({
  patient,
  done,
}: {
  patient?: Patient;
  done: (message: string, id?: string) => void;
}) {
  return (
    <Form
      label={patient ? "Save changes" : "Register patient"}
      submit={async (d) => {
        const values = Object.fromEntries(d);
        const r = await api<{ patient: Patient; duplicates?: Patient[] }>(
          "patients" + (patient ? "/" + patient.id : ""),
          { ...values, ...(patient ? { version: patient.version } : {}) },
        );
        done(
          r.duplicates?.length
            ? "Patient registered. A possible duplicate needs review."
            : "Patient record saved.",
          r.patient.id,
        );
      }}
    >
      <div className="note-box">
        Use fictional patient details only. The system assigns a unique medical
        record number.
      </div>
      <div className="form-grid">
        <label>
          First name
          <input
            name="firstName"
            defaultValue={patient?.firstName}
            maxLength={80}
            autoComplete="off"
            required
          />
        </label>
        <label>
          Last name
          <input
            name="lastName"
            defaultValue={patient?.lastName}
            maxLength={80}
            required
          />
        </label>
        <label>
          Date of birth
          <input
            name="dob"
            type="date"
            max={today()}
            defaultValue={patient?.dob}
            required
          />
        </label>
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={patient?.phone}
            maxLength={30}
            minLength={7}
            required
          />
        </label>
        <label className="full">
          Address
          <input
            name="address"
            defaultValue={patient?.address}
            maxLength={300}
            required
          />
        </label>
        <label>
          Gender
          <select name="gender" defaultValue={patient?.gender || "Not stated"}>
            {["Not stated", "Female", "Male", "Other"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Insurance reference (optional)
          <input
            name="insurance"
            maxLength={100}
            defaultValue={patient?.insurance}
          />
        </label>
        <label className="full">
          Emergency contact (optional)
          <input
            name="emergencyContact"
            defaultValue={patient?.emergencyContact}
            maxLength={200}
          />
        </label>
        <label className="full">
          Provisional record reason (optional)
          <textarea
            name="provisionalReason"
            defaultValue={patient?.provisionalReason}
            maxLength={500}
          />
          <span className="field-help">
            Use this only when the primary record cannot be identified. A doctor
            must review it.
          </span>
        </label>
      </div>
    </Form>
  );
}
function BookingForm({
  patients,
  doctors,
  patient,
  appointment,
  done,
}: {
  patients: Patient[];
  doctors: Doctor[];
  patient?: Patient;
  appointment?: Appointment;
  done: () => void;
}) {
  const [date, setDate] = useState(
    appointment ? appointment.startAt.slice(0, 10) : today(),
  );
  const [doctor, setDoctor] = useState(
    appointment?.doctorId || doctors[0]?.id || "",
  );
  const [slots, setSlots] = useState<{ startAt: string; endAt: string }[]>([]);
  const [slot, setSlot] = useState("");
  const [length, setLength] = useState(
    appointment
      ? (Date.parse(appointment.endAt) - Date.parse(appointment.startAt)) /
          60000
      : 30,
  );
  const [selectedPatient, setSelectedPatient] = useState(
    patient || patients.find((p) => p.id === appointment?.patientId),
  );
  const [review, setReview] = useState<{
    patientId: string;
    doctorId: string;
    startAt: string;
    endAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!doctor && doctors.length) setDoctor(doctors[0].id);
  }, [doctor, doctors]);
  useEffect(() => {
    let active = true;
    setError("");
    setSlots([]);
    setSlot("");
    if (doctor)
      api<{ startAt: string; endAt: string }[]>(
        `availability?doctorId=${doctor}&date=${date}&duration=${length}${selectedPatient ? "&patientId=" + selectedPatient.id : ""}${appointment ? "&excludeId=" + appointment.id : ""}`,
      )
        .then((v) => {
          if (active) setSlots(v);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [doctor, date, length, selectedPatient?.id, appointment?.id]);
  return (
    <Form
      label={review ? "Confirm appointment" : "Review appointment"}
      secondary={
        review ? (
          <button
            type="button"
            className="button"
            onClick={() => setReview(null)}
          >
            Change details
          </button>
        ) : null
      }
      submit={async (d) => {
        if (!review) {
          if (!selectedPatient) throw Error("Choose a patient.");
          const start = field(d, "startAt");
          if (!start) throw Error("Choose an available time.");
          setReview({
            patientId: field(d, "patientId"),
            doctorId: doctor,
            startAt: new Date(start).toISOString(),
            endAt: new Date(Date.parse(start) + length * 60000).toISOString(),
          });
          return;
        }
        await api("appointments" + (appointment ? "/" + appointment.id : ""), {
          ...review,
          ...(appointment ? { version: appointment.version } : {}),
        });
        done();
      }}
    >
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div hidden={Boolean(review)} className="clinical-form">
        <PatientSelect
          patients={patients}
          selectedId={appointment?.patientId}
          onSelect={setSelectedPatient}
          selected={
            patient || patients.find((p) => p.id === appointment?.patientId)
          }
        />
        <label>
          Doctor
          <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              min={today()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlot("");
              }}
              required
            />
          </label>
          <label>
            Length
            <select
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            >
              {[15, 30, 45, 60, 90, 120, 240].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Available start time
          <select
            name="startAt"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            required
          >
            <option value="">Choose a time</option>
            {slots.map((s) => (
              <option key={s.startAt} value={s.startAt}>
                {timeText(s.startAt)}
              </option>
            ))}
          </select>
        </label>
        {!slots.length && (
          <p className="note-box">
            No times are available on this date. Try the next weekday.
          </p>
        )}
        <p className="field-help">
          Times use Jamaica time. Availability can change before confirmation.
        </p>
      </div>
      {review && (
        <div className="note-box">
          <h3>Ready to confirm?</h3>
          <p>
            {selectedPatient?.firstName} {selectedPatient?.lastName} /{" "}
            {selectedPatient?.mrn}
          </p>
          <p>{doctors.find((d) => d.id === review.doctorId)?.name}</p>
          <p>
            {dateText(review.startAt)} / {timeText(review.startAt)} to{" "}
            {timeText(review.endAt)}
          </p>
          <p>The appointment is saved only after you confirm.</p>
        </div>
      )}
    </Form>
  );
}
function ClinicalEditor({
  visit,
  revision,
  saved,
}: {
  visit: Visit;
  revision?: Revision;
  saved: () => void;
}) {
  const [meds, setMeds] = useState<ClinicalContent["medications"]>(
    revision?.content.medications || [],
  );
  const content = revision?.content || emptyClinical;
  const final = revision?.state === "final";
  return (
    <Form
      label={final ? "Save final correction" : "Save clinical entry"}
      submit={async (d) => {
        await api(`visits/${visit.id}/clinical`, {
          expectedRevision: visit.revision,
          state: final ? "final" : field(d, "state"),
          symptoms: field(d, "symptoms"),
          notes: field(d, "notes"),
          diagnosis: field(d, "diagnosis"),
          treatment: field(d, "treatment"),
          allergies: field(d, "allergies"),
          vitals: field(d, "vitals"),
          labResults: field(d, "labResults"),
          certificate: field(d, "certificate"),
          reason: field(d, "reason"),
          medications: meds,
        });
        saved();
      }}
    >
      <div className="note-box">
        {final
          ? "This entry is final. A correction creates a new revision and keeps the previous entry."
          : "Record only the findings and decisions entered by the doctor. No diagnosis or treatment is generated."}
      </div>
      <div className="form-grid">
        {(
          [
            "symptoms",
            "notes",
            "diagnosis",
            "treatment",
            "allergies",
            "vitals",
            "labResults",
          ] as const
        ).map((k) => (
          <label
            key={k}
            className={
              ["notes", "treatment", "labResults"].includes(k) ? "full" : ""
            }
          >
            {
              {
                symptoms: "Symptoms and concerns",
                notes: "Consultation notes",
                diagnosis: "Diagnosis",
                treatment: "Treatment record",
                allergies: "Allergies",
                vitals: "Vitals and units",
                labResults: "Manual lab results",
              }[k]
            }
            <textarea
              aria-label={
                {
                  symptoms: "Symptoms and concerns",
                  notes: "Consultation notes",
                  diagnosis: "Diagnosis",
                  treatment: "Treatment record",
                  allergies: "Allergies",
                  vitals: "Vitals and units",
                  labResults: "Manual lab results",
                }[k]
              }
              name={k}
              defaultValue={content[k]}
              maxLength={
                k === "notes"
                  ? 12000
                  : k === "symptoms" || k === "treatment"
                    ? 8000
                    : k === "labResults"
                      ? 6000
                      : k === "diagnosis"
                        ? 4000
                        : 2000
              }
            />
          </label>
        ))}
      </div>
      <section className="form-section">
        <div className="timeline-title">
          <h3>Prescription details</h3>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setMeds([
                ...meds,
                {
                  medication: "",
                  dosage: "",
                  route: "",
                  frequency: "",
                  duration: "",
                  quantity: "",
                  instructions: "",
                },
              ])
            }
            disabled={meds.length >= 20}
          >
            <Plus size={15} />
            Add medicine
          </button>
        </div>
        <p className="field-help">
          The printed prescription uses these exact doctor-entered details.
        </p>
        {meds.map((med, i) => (
          <div className="medication-block" key={i}>
            <div className="form-grid">
              {(Object.keys(med) as (keyof typeof med)[]).map((k) => (
                <label key={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                  {k === "instructions" ? " (optional)" : ""}
                  <input
                    value={med[k]}
                    required={k !== "instructions"}
                    maxLength={k === "instructions" ? 500 : 150}
                    onChange={(e) =>
                      setMeds(
                        meds.map((m, j) =>
                          j === i ? { ...m, [k]: e.target.value } : m,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              className="text-button danger"
              type="button"
              onClick={() => setMeds(meds.filter((_, j) => j !== i))}
            >
              Remove medicine
            </button>
          </div>
        ))}
      </section>
      <label>
        Medical certificate text (optional)
        <textarea
          name="certificate"
          defaultValue={content.certificate}
          maxLength={6000}
        />
      </label>
      {!final && (
        <label>
          Entry state
          <select name="state" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="final">Final, ready for filing</option>
          </select>
        </label>
      )}
      <label>
        {final ? "Correction reason" : "Revision reason (optional)"}
        <textarea name="reason" maxLength={1000} required={final} />
      </label>
    </Form>
  );
}
export default function Workspace({
  actor,
  demo,
}: {
  actor: Staff;
  demo: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const page = segments[1] || "overview";
  const patientId = page === "patients" ? segments[2] : undefined;
  const doctor = actor.role === "doctor";
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [hours, setHours] = useState<Hours | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Overview");
  const [visitId, setVisitId] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 6000);
  };
  const done = (message = "Saved successfully.", id?: string) => {
    setModal(null);
    notify(message);
    setRefresh((n) => n + 1);
    if (id) router.push("/app/patients/" + id);
  };
  const load = useCallback(
    async (signal: AbortSignal) => {
      setError("");
      setLoading(true);
      try {
        const [p, d] = await Promise.all([
          api<Patient[]>("patients", undefined, "GET", signal),
          api<Doctor[]>("doctors", undefined, "GET", signal),
        ]);
        if (signal.aborted) return;
        setPatients(p);
        setDoctors(d);
        if (patientId)
          setDetail(
            await api<Detail>(
              "patients/" + patientId,
              undefined,
              "GET",
              signal,
            ),
          );
        else if (page === "overview") {
          const [s, a] = await Promise.all([
            api<Dashboard>("dashboard", undefined, "GET", signal),
            api<Appointment[]>(
              "appointments?date=" + date,
              undefined,
              "GET",
              signal,
            ),
          ]);
          setDashboard(s);
          setAppointments(a);
        } else if (page === "appointments")
          setAppointments(
            await api<Appointment[]>(
              "appointments?date=" + date,
              undefined,
              "GET",
              signal,
            ),
          );
        else if (page === "documents")
          setDocs(await api<Doc[]>("documents", undefined, "GET", signal));
        else if (page === "invoices")
          setInvoices(
            await api<Invoice[]>("invoices", undefined, "GET", signal),
          );
        else if (page === "accounts")
          setAccounts(await api<Account[]>("users", undefined, "GET", signal));
        else if (page === "audit")
          setAudit(await api<Audit[]>("audit", undefined, "GET", signal));
        else if (page === "settings")
          setHours(await api<Hours>("hours", undefined, "GET", signal));
        else if (page === "reports")
          setTrends(
            (
              await api<{ counts: Trend[] }>(
                "reports/visits?id=all",
                undefined,
                "GET",
                signal,
              )
            ).counts,
          );
      } catch (e) {
        if (signal.aborted) return;
        setError(
          e instanceof Error ? e.message : "The records could not be loaded.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, patientId, date],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refresh]);
  useEffect(() => {
    setMobileMenu(false);
    setTab("Overview");
  }, [pathname]);
  useEffect(() => {
    if (page !== "patients" || patientId) return;
    let active = true;
    const t = setTimeout(() => {
      api<Patient[]>("patients?q=" + encodeURIComponent(search))
        .then((p) => {
          if (active) setPatients(p);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, page, patientId, refresh]);
  const act = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      notify(message);
      setRefresh((n) => n + 1);
    } catch (e) {
      notify(
        "Error: " + (e instanceof Error ? e.message : "The change failed."),
      );
    }
  };
  const nav = [
    { id: "overview", label: "Today", icon: LayoutDashboard },
    { id: "patients", label: "Patients", icon: Users },
    { id: "appointments", label: "Appointments", icon: CalendarDays },
    ...(doctor ? [{ id: "documents", label: "Documents", icon: Files }] : []),
    { id: "invoices", label: "Invoices", icon: ReceiptText },
    { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
  ];
  const admin = [
    ...(doctor
      ? [
          { id: "accounts", label: "Staff accounts", icon: Users },
          { id: "audit", label: "Audit history", icon: ShieldCheck },
        ]
      : []),
    { id: "settings", label: "Practice settings", icon: Settings2 },
  ];
  const current =
    detail && detail.patient.id === patientId ? detail.patient : undefined;
  const activeVisit =
    detail?.visits.find((v) => v.id === visitId) ||
    detail?.visits.find((v) => v.status === "open") ||
    detail?.visits[0];
  const latest = detail?.clinical?.find(
    (c) =>
      c.visitId === activeVisit?.id && c.revision === activeVisit?.revision,
  );
  const pageTitle = patientId
    ? "Patient record"
    : (
        {
          overview: "Today at the practice",
          patients: "Patient directory",
          appointments: "Appointments",
          documents: "Diagnostic documents",
          invoices: "Manual invoices",
          reports: "Practice reports",
          accounts: "Staff accounts",
          audit: "Audit history",
          settings: "Practice settings",
        } as Record<string, string>
      )[page] || "Practice overview";
  function appointmentTable(list: Appointment[]) {
    return list.length ? (
      <>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TIME</th>
                <th>PATIENT</th>
                <th className="desktop-cell">DOCTOR</th>
                <th>STATUS</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td className="time-cell">
                    {timeText(a.startAt)}
                    <span className="cell-sub">
                      {Math.round(
                        (Date.parse(a.endAt) - Date.parse(a.startAt)) / 60000,
                      )}{" "}
                      min
                    </span>
                  </td>
                  <td>
                    <Link href={"/app/patients/" + a.patientId}>
                      <Person
                        patient={{
                          firstName: a.firstName || "",
                          lastName: a.lastName || "",
                        }}
                        sub={a.mrn}
                      />
                    </Link>
                  </td>
                  <td className="desktop-cell">{a.doctorName}</td>
                  <td>
                    <Status value={a.status} />
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={
                        "Manage appointment for " +
                        a.firstName +
                        " " +
                        a.lastName
                      }
                      onClick={() =>
                        setModal({
                          kind: "appointment-actions",
                          appointment: a,
                        })
                      }
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>{list.length} appointments</span>
          <span>Jamaica time</span>
        </div>
      </>
    ) : (
      <Empty title="No appointments on this date.">
        Choose another date or book a visit.
      </Empty>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="practice-header">
        <Link href="/app" className="brand">
          <span className="brand-mark">
            p<span>+</span>
          </span>
          <span>
            PracticeChart
            <span className="brand-sub">ELECTRONIC HEALTH RECORDS</span>
          </span>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <Link
              href={"/app/" + (n.id === "overview" ? "" : n.id)}
              key={n.id}
              className={page === n.id ? "active" : ""}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={18} strokeWidth={1.6} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="nav-separator" />
        <p className="nav-caption">MANAGEMENT</p>
        <nav aria-label="Management navigation">
          {admin.map((n) => (
            <Link
              key={n.id}
              href={"/app/" + n.id}
              className={page === n.id ? "active" : ""}
            >
              <n.icon size={18} strokeWidth={1.6} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={18} />
            <strong>Careful by design.</strong>Access follows your role. Every
            record change leaves a history.
          </div>
          <div className="user-block">
            <span className="avatar">
              {actor.name
                .replace("Dr. ", "")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <strong>{actor.name}</strong>
              <small>{doctor ? "Doctor" : "Front desk"}</small>
            </div>
            <button
              className="text-button"
              style={{ color: "#d9e9da", marginLeft: "auto" }}
              aria-label="Log out"
              onClick={() =>
                act(async () => {
                  await api("logout", {});
                  window.location.href = "/login";
                }, "Logged out.")
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>
      <div className="app-main">
        <div className="topbar">
          <div className="topbar-location">
            <span>PracticeChart</span>
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <Link href="/app" className="brand mobile-brand">
            <span className="brand-mark">
              p<span>+</span>
            </span>
            PracticeChart
          </Link>
          <div className="topbar-actions">
            <span className="topbar-date">
              {dateText(new Date().toISOString(), {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <button
              className="button primary"
              onClick={() =>
                setModal({ kind: "appointment", patient: current })
              }
            >
              <Plus size={16} />
              Book appointment
            </button>
          </div>
        </div>
        <main id="main-content" className="workspace-content" tabIndex={-1}>
          <div className="demo-banner">
            <ShieldCheck size={14} />
            <span>Fictional practice / Use fictional data only</span>
            <span>{doctor ? "Doctor workspace" : "Front desk workspace"}</span>
          </div>
          <div className="page-heading">
            <div>
              <h1>
                {patientId && current
                  ? `${current.firstName} ${current.lastName}`
                  : pageTitle}
              </h1>
              <p>
                {page === "overview"
                  ? "Your day, your patients, and what comes next."
                  : patientId
                    ? "One record. A clear history."
                    : (
                        {
                          patients: "Find a record or register a new patient.",
                          appointments:
                            "Plan the day and keep each visit on track.",
                          documents:
                            "Private reports, linked to the right patient.",
                          invoices:
                            "Service charges only. No payment processing.",
                          reports:
                            "Clear outputs for the practice and the patient.",
                          accounts: "Manage staff access with care.",
                          audit:
                            "A record of access, changes, and corrections.",
                          settings: "Set availability and manage your account.",
                        } as Record<string, string>
                      )[page]}
              </p>
            </div>
            <div className="heading-actions">
              {page === "patients" && !patientId && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "patient" })}
                >
                  <UserPlus size={16} />
                  Register patient
                </button>
              )}
              {patientId && current && (
                <button
                  className="button"
                  onClick={() =>
                    setModal({ kind: "patient", patient: current })
                  }
                >
                  Edit details
                </button>
              )}
              {page === "documents" && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "document" })}
                >
                  <Plus size={16} />
                  Add report
                </button>
              )}
              {page === "invoices" && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "invoice" })}
                >
                  <Plus size={16} />
                  New invoice
                </button>
              )}
              {page === "accounts" && doctor && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "user" })}
                >
                  <UserPlus size={16} />
                  Add account
                </button>
              )}
            </div>
          </div>
          {error ? (
            <div className="error" role="alert">
              {error}{" "}
              <button
                className="text-button"
                onClick={() => setRefresh((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="loading" role="status">
              Loading practice records...
            </div>
          ) : (
            <>
              {page === "overview" && dashboard && (
                <>
                  <section
                    className="summary-strip"
                    aria-label="Practice totals"
                  >
                    {[
                      {
                        label: "Today's appointments",
                        value: dashboard.counts.appointments,
                        note: "Confirmed, arrived, or in consultation",
                        icon: CalendarDays,
                      },
                      {
                        label: "Active patients",
                        value: dashboard.counts.patients,
                        note: "Registered in the practice",
                        icon: Users,
                      },
                      {
                        label: "Ready to file",
                        value: dashboard.counts.ready,
                        note: "Clinical entries completed",
                        icon: ClipboardList,
                      },
                      {
                        label: "Filed visits",
                        value: dashboard.counts.filed,
                        note: "Recorded in the visit logbook",
                        icon: Check,
                      },
                    ].map((s) => (
                      <div className="summary-stat" key={s.label}>
                        <span>
                          {s.label}
                          <s.icon size={16} strokeWidth={1.5} />
                        </span>
                        <strong>{s.value}</strong>
                        <small>{s.note}</small>
                      </div>
                    ))}
                  </section>
                  <div className="dashboard-grid">
                    <Panel
                      title="Patient worklist"
                      subtitle={dateText(date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                      action={
                        <Link className="text-button" href="/app/appointments">
                          View schedule
                          <ArrowUpRight size={14} />
                        </Link>
                      }
                    >
                      {appointmentTable(appointments)}
                    </Panel>
                    <div className="stack">
                      <Panel title="Quick actions">
                        <div className="quick-links">
                          <button onClick={() => setModal({ kind: "patient" })}>
                            <UserPlus />
                            <span>
                              Register a patient
                              <small>Start a new patient record</small>
                            </span>
                            <ArrowUpRight size={15} />
                          </button>
                          <button onClick={() => setModal({ kind: "visit" })}>
                            <Stethoscope />
                            <span>
                              Start a walk-in visit
                              <small>Prepare the patient for the doctor</small>
                            </span>
                            <ArrowUpRight size={15} />
                          </button>
                          <Link href="/app/reports">
                            <FileText />
                            <span>
                              Open reports
                              <small>Patient and practice outputs</small>
                            </span>
                            <ArrowUpRight size={15} />
                          </Link>
                        </div>
                      </Panel>
                      <Panel
                        title="Ready to file"
                        subtitle="Completed by the doctor"
                      >
                        {dashboard.ready.length ? (
                          dashboard.ready.map((v) => (
                            <div className="ready-item" key={v.id}>
                              <div>
                                <Link href={"/app/patients/" + v.patientId}>
                                  <Person patient={v} sub={v.mrn} />
                                </Link>
                              </div>
                              <button
                                className="text-button"
                                onClick={() =>
                                  act(
                                    () =>
                                      api(`visits/${v.id}/file`, {
                                        expectedRevision: v.revision,
                                      }),
                                    "Visit filed in the logbook.",
                                  )
                                }
                              >
                                <Check size={13} />
                                File visit
                              </button>
                            </div>
                          ))
                        ) : (
                          <Empty title="All caught up.">
                            Completed entries will appear here.
                          </Empty>
                        )}
                      </Panel>
                      <Panel title="Upcoming reminders">
                        {dashboard.reminders.length ? (
                          dashboard.reminders.map((r) => (
                            <div className="ready-item" key={r.id}>
                              <strong>
                                {r.firstName} {r.lastName}
                              </strong>
                              <p className="muted">
                                {dateText(r.startAt)} at {timeText(r.startAt)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <Empty title="No reminders due.">
                            Reminders are created by the daily job.
                          </Empty>
                        )}
                      </Panel>
                    </div>
                  </div>
                </>
              )}
              {page === "patients" && !patientId && (
                <Panel>
                  <div className="toolbar">
                    <label className="search-input">
                      <span className="sr-only">Search patients</span>
                      <Search size={16} />
                      <input
                        placeholder="Search by name or medical record number"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        type="search"
                      />
                    </label>
                    <span className="result-count">
                      {patients.length} records shown
                    </span>
                  </div>
                  {patients.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>PATIENT</th>
                            <th>MEDICAL RECORD</th>
                            <th className="desktop-cell">DATE OF BIRTH</th>
                            <th className="desktop-cell">PHONE</th>
                            <th>STATUS</th>
                            <th>
                              <span className="sr-only">Open record</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {patients.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <Link href={"/app/patients/" + p.id}>
                                  <Person patient={p} />
                                </Link>
                              </td>
                              <td>{p.mrn}</td>
                              <td className="desktop-cell">
                                {dateText(p.dob)}
                              </td>
                              <td className="desktop-cell">{p.phone}</td>
                              <td>
                                <Status
                                  value={
                                    p.mergedInto
                                      ? "linked"
                                      : p.archived
                                        ? "archived"
                                        : p.provisionalReason
                                          ? "provisional"
                                          : "active"
                                  }
                                />
                              </td>
                              <td>
                                <Link
                                  className="icon-button"
                                  href={"/app/patients/" + p.id}
                                  aria-label={
                                    "Open " + p.firstName + " " + p.lastName
                                  }
                                >
                                  <ArrowUpRight size={16} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="No matching patients.">
                      Try a different name or medical record number.
                    </Empty>
                  )}
                </Panel>
              )}
              {page === "appointments" && (
                <Panel>
                  <div className="toolbar">
                    <label>
                      Schedule date
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                    <span className="result-count">
                      {dateText(date, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    <PrintLink
                      type="schedule"
                      id={date}
                      label="Print schedule"
                    />
                  </div>
                  {appointmentTable(appointments)}
                </Panel>
              )}
              {patientId && current && detail && (
                <>
                  <Panel>
                    <div className="patient-header">
                      <span className="avatar large">{initials(current)}</span>
                      <div>
                        <h2>
                          {current.firstName} {current.lastName}
                        </h2>
                        <p>
                          {current.mrn} <span aria-hidden="true">/</span>{" "}
                          {dateText(current.dob)}{" "}
                          <span aria-hidden="true">/</span> {current.gender}
                        </p>
                      </div>
                      <div style={{ marginLeft: "auto" }}>
                        <Status
                          value={
                            current.archived
                              ? "archived"
                              : current.provisionalReason
                                ? "provisional"
                                : "active"
                          }
                        />
                      </div>
                    </div>
                    <div
                      className="record-sections"
                      role="tablist"
                      aria-label="Patient record sections"
                    >
                      {[
                        "Overview",
                        "Visits",
                        ...(doctor ? ["Clinical record", "Documents"] : []),
                      ].map((t) => (
                        <button
                          key={t}
                          role="tab"
                          id={"tab-" + t.replaceAll(" ", "-")}
                          aria-controls="patient-tab-panel"
                          aria-selected={tab === t}
                          tabIndex={tab === t ? 0 : -1}
                          onKeyDown={(e) => {
                            if (
                              [
                                "ArrowLeft",
                                "ArrowRight",
                                "Home",
                                "End",
                              ].includes(e.key)
                            ) {
                              e.preventDefault();
                              const tabs = Array.from(
                                e.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                                  "[role=tab]",
                                ),
                              );
                              let i = tabs.indexOf(e.currentTarget);
                              i =
                                e.key === "Home"
                                  ? 0
                                  : e.key === "End"
                                    ? tabs.length - 1
                                    : (i +
                                        (e.key === "ArrowRight" ? 1 : -1) +
                                        tabs.length) %
                                      tabs.length;
                              tabs[i].click();
                              tabs[i].focus();
                            }
                          }}
                          onClick={() => setTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Panel>
                  <div
                    role="tabpanel"
                    id="patient-tab-panel"
                    aria-labelledby={"tab-" + tab.replaceAll(" ", "-")}
                  >
                    {tab === "Overview" && (
                      <div className="detail-grid">
                        <Panel title="Patient details">
                          <div className="panel-body">
                            <dl className="facts">
                              {[
                                ["Medical record number", current.mrn],
                                ["Date of birth", dateText(current.dob)],
                                ["Phone", current.phone],
                                ["Gender", current.gender],
                                ["Address", current.address],
                                [
                                  "Emergency contact",
                                  current.emergencyContact || "Not recorded",
                                ],
                                [
                                  "Insurance reference",
                                  current.insurance || "Not recorded",
                                ],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <dt>{k}</dt>
                                  <dd>{v}</dd>
                                </div>
                              ))}
                            </dl>
                            {current.provisionalReason && (
                              <div className="note-box">
                                Provisional record: {current.provisionalReason}
                                {doctor && !current.mergedInto && (
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      setModal({
                                        kind: "reconcile",
                                        patient: current,
                                      })
                                    }
                                  >
                                    Link to primary record
                                  </button>
                                )}
                              </div>
                            )}
                            {current.mergedInto && (
                              <p className="note-box">
                                This record links to{" "}
                                <Link
                                  className="text-button"
                                  href={"/app/patients/" + current.mergedInto}
                                >
                                  the primary record <ArrowUpRight size={14} />
                                </Link>
                                . Its earlier history remains here.
                              </p>
                            )}
                          </div>
                        </Panel>
                        <div className="stack">
                          <Panel title="Record actions">
                            <div className="quick-links">
                              <button
                                onClick={() =>
                                  setModal({ kind: "visit", patient: current })
                                }
                              >
                                <Stethoscope />
                                <span>Start walk-in visit</span>
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  setModal({
                                    kind: "appointment",
                                    patient: current,
                                  })
                                }
                              >
                                <CalendarPlus />
                                <span>Book appointment</span>
                                <Plus size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  setModal({
                                    kind: "invoice",
                                    patient: current,
                                  })
                                }
                              >
                                <ReceiptText />
                                <span>Create invoice</span>
                                <Plus size={14} />
                              </button>
                              {doctor && (
                                <a
                                  href={`/print/history?id=${current.id}`}
                                  target="_blank"
                                  rel="noopener"
                                >
                                  <FileText />
                                  <span>Print patient report</span>
                                  <ArrowUpRight size={14} />
                                </a>
                              )}
                              {doctor && (
                                <button
                                  onClick={() =>
                                    setModal({
                                      kind: "archive",
                                      patient: current,
                                    })
                                  }
                                >
                                  <FolderOpen />
                                  <span>
                                    {current.archived
                                      ? "Restore patient record"
                                      : "Archive patient record"}
                                  </span>
                                  <ArrowRight size={14} />
                                </button>
                              )}
                            </div>
                          </Panel>
                          <Panel title="Recent visits">
                            <div className="panel-body">
                              <strong style={{ fontSize: 30, fontWeight: 500 }}>
                                {detail.visits.length}
                              </strong>
                              <p className="muted">
                                Visits linked to this record
                              </p>
                              <button
                                className="text-button"
                                onClick={() => setTab("Visits")}
                              >
                                View visit history
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </Panel>
                        </div>
                      </div>
                    )}
                    {tab === "Visits" && (
                      <div style={{ marginTop: 24 }}>
                        <Panel
                          title="Visit history"
                          subtitle="Filing a visit preserves the patient record"
                        >
                          {detail.visits.length ? (
                            detail.visits.map((v) => (
                              <article className="timeline-item" key={v.id}>
                                <div className="timeline-title">
                                  <strong>
                                    {dateText(v.visitAt)} / {v.doctorName}
                                  </strong>
                                  <Status value={v.status} />
                                </div>
                                <p className="muted">
                                  {v.revision} clinical revisions{" "}
                                  {v.filedAt
                                    ? "/ Filed " + dateText(v.filedAt)
                                    : ""}
                                </p>
                                <div className="action-row">
                                  {doctor && (
                                    <button
                                      className="button"
                                      onClick={() => {
                                        setVisitId(v.id);
                                        setTab("Clinical record");
                                      }}
                                    >
                                      Open clinical record
                                    </button>
                                  )}
                                  {v.status === "ready" && (
                                    <button
                                      className="button primary"
                                      onClick={() =>
                                        act(
                                          () =>
                                            api(`visits/${v.id}/file`, {
                                              expectedRevision: v.revision,
                                            }),
                                          "Visit filed.",
                                        )
                                      }
                                    >
                                      <Check size={14} />
                                      File visit
                                    </button>
                                  )}
                                  <PrintLink
                                    type="attendance"
                                    id={v.id}
                                    label="Attendance slip"
                                  />
                                  {doctor && v.revision > 0 && (
                                    <>
                                      <PrintLink
                                        type="summary"
                                        id={v.id}
                                        label="Visit summary"
                                      />
                                      <PrintLink
                                        type="prescription"
                                        id={v.id}
                                        label="Prescription"
                                      />
                                      <PrintLink
                                        type="certificate"
                                        id={v.id}
                                        label="Certificate"
                                      />
                                    </>
                                  )}
                                </div>
                              </article>
                            ))
                          ) : (
                            <Empty title="No visits recorded.">
                              Start a walk-in visit or use an appointment.
                            </Empty>
                          )}
                        </Panel>
                      </div>
                    )}
                    {tab === "Clinical record" && doctor && (
                      <div style={{ marginTop: 24 }}>
                        {activeVisit ? (
                          <div className="detail-grid">
                            <Panel
                              title="Clinical entry"
                              subtitle="Doctor access only"
                            >
                              <div className="panel-body">
                                <label>
                                  Visit
                                  <select
                                    value={activeVisit.id}
                                    onChange={(e) => setVisitId(e.target.value)}
                                  >
                                    {detail.visits.map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {dateText(v.visitAt)} / {v.status} /
                                        revision {v.revision}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div style={{ marginTop: 24 }}>
                                  <ClinicalEditor
                                    key={
                                      activeVisit.id +
                                      ":" +
                                      activeVisit.revision
                                    }
                                    visit={activeVisit}
                                    revision={latest}
                                    saved={() => {
                                      notify("Clinical revision saved.");
                                      setRefresh((n) => n + 1);
                                      setTimeout(
                                        () => setTab("Clinical record"),
                                        10,
                                      );
                                    }}
                                  />
                                </div>
                              </div>
                            </Panel>
                            <Panel
                              title="Previous clinical entries"
                              subtitle="Earlier revisions stay available"
                            >
                              {detail.clinical
                                ?.filter((c) => c.visitId === activeVisit.id)
                                .map((c) => (
                                  <article className="timeline-item" key={c.id}>
                                    <div className="timeline-title">
                                      <strong>Revision {c.revision}</strong>
                                      <Status value={c.state} />
                                    </div>
                                    <small>
                                      {dateText(c.createdAt)} / {c.authorName}
                                    </small>
                                    {c.reason && (
                                      <p>
                                        <strong>Reason:</strong> {c.reason}
                                      </p>
                                    )}
                                    {Object.entries(c.content)
                                      .filter(
                                        ([k, v]) =>
                                          k !== "medications" && Boolean(v),
                                      )
                                      .map(([k, v]) => (
                                        <p key={k}>
                                          <strong>
                                            {k.replace(/([A-Z])/g, " $1")}:
                                          </strong>{" "}
                                          {String(v)}
                                        </p>
                                      ))}
                                    {c.content.medications.map((m, i) => (
                                      <p key={i}>
                                        <strong>{m.medication}</strong> /{" "}
                                        {m.dosage}, {m.route}, {m.frequency},{" "}
                                        {m.duration}, quantity {m.quantity}.{" "}
                                        {m.instructions}
                                      </p>
                                    ))}
                                  </article>
                                )) || <Empty />}
                            </Panel>
                          </div>
                        ) : (
                          <Panel>
                            <Empty title="Start a visit first.">
                              Use Record actions to start the patient visit.
                            </Empty>
                          </Panel>
                        )}
                      </div>
                    )}
                    {tab === "Documents" && doctor && (
                      <div style={{ marginTop: 24 }}>
                        <div
                          className="action-row"
                          style={{ marginBottom: 20 }}
                        >
                          <button
                            className="button primary"
                            onClick={() =>
                              setModal({ kind: "document", patient: current })
                            }
                          >
                            <Plus size={16} />
                            Add report
                          </button>
                          <a className="button" href="/api/sample-report">
                            Download sample report
                          </a>
                        </div>
                        <DocumentCards
                          docs={detail.documents || []}
                          onReplace={(d) =>
                            setModal({
                              kind: "document",
                              patient: current,
                              replacesId: d.id,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
              {page === "documents" && doctor && (
                <>
                  <p className="note-box" style={{ marginBottom: 24 }}>
                    Reports are private. In the public demo, upload only the{" "}
                    <a className="text-button" href="/api/sample-report">
                      supplied sample report
                      <Download size={13} />
                    </a>
                    .
                  </p>
                  <DocumentCards docs={docs} />
                </>
              )}
              {page === "invoices" && (
                <Panel>
                  {invoices.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>INVOICE</th>
                            <th>PATIENT</th>
                            <th>TOTAL (JMD)</th>
                            <th>STATUS</th>
                            <th>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map((i) => (
                            <tr key={i.id}>
                              <td>
                                {i.number}
                                <span className="cell-sub">
                                  {dateText(i.createdAt)}
                                </span>
                              </td>
                              <td>
                                {i.firstName} {i.lastName}
                              </td>
                              <td>{money(i.totalCents)}</td>
                              <td>
                                <Status value={i.status} />
                              </td>
                              <td>
                                <div className="action-row">
                                  <PrintLink type="invoice" id={i.id} />
                                  {i.status === "draft" && (
                                    <button
                                      className="button"
                                      onClick={() =>
                                        act(
                                          () =>
                                            api("invoices/" + i.id, {
                                              version: i.version,
                                              status: "issued",
                                            }),
                                          "Invoice issued.",
                                        )
                                      }
                                    >
                                      Issue
                                    </button>
                                  )}
                                  {i.status === "issued" && (
                                    <button
                                      className="button danger"
                                      onClick={() =>
                                        setModal({ kind: "void", invoice: i })
                                      }
                                    >
                                      Void
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty title="No invoices yet.">
                      Create an invoice from manually entered service charges.
                    </Empty>
                  )}
                </Panel>
              )}
              {page === "reports" && (
                <>
                  <div className="report-grid">
                    <Panel>
                      <div className="report-card">
                        <CalendarDays size={24} />
                        <h3>Appointment schedule</h3>
                        <p>
                          Print the appointments for one day. Clinical notes are
                          not included.
                        </p>
                        <label>
                          Date
                          <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                          />
                        </label>
                        <PrintLink
                          type="schedule"
                          id={date}
                          label="Open schedule"
                        />
                      </div>
                    </Panel>
                    {doctor && (
                      <Panel>
                        <div className="report-card">
                          <ClipboardList size={24} />
                          <h3>Patient history</h3>
                          <p>
                            Print the patient's clinical history, medications,
                            and diagnostic report list.
                          </p>
                          <PatientReportSelect patients={patients} />
                        </div>
                      </Panel>
                    )}
                    <Panel>
                      <div className="report-card">
                        <Activity size={24} />
                        <h3>Visit logbook</h3>
                        <p>
                          View visit counts and filed visits. This report
                          contains no clinical details.
                        </p>
                        <PrintLink
                          type="visits"
                          id="all"
                          label="Open logbook"
                        />
                      </div>
                    </Panel>
                  </div>
                  <div style={{ marginTop: 24 }}>
                    <Panel
                      title="Visits by day"
                      subtitle="Actual counts from the fictional database"
                    >
                      <div className="panel-body">
                        {trends.length ? (
                          trends.map((t) => (
                            <div className="chart-row" key={t.day}>
                              <span>{dateText(t.day)}</span>
                              <div
                                className="chart-bar"
                                style={{
                                  width:
                                    Math.max(
                                      2,
                                      (Number(t.visits) /
                                        Math.max(
                                          ...trends.map((v) =>
                                            Number(v.visits),
                                          ),
                                        )) *
                                        60,
                                    ) + "%",
                                }}
                              />
                              <strong>
                                {t.visits} visits / {t.filed} filed
                              </strong>
                            </div>
                          ))
                        ) : (
                          <Empty title="No visit counts yet." />
                        )}
                      </div>
                    </Panel>
                  </div>
                  <p className="note-box" style={{ marginTop: 24 }}>
                    A patient report is a reading copy. It is not a full
                    database backup. Backups and restores use separate operator
                    commands.
                  </p>
                </>
              )}
              {page === "accounts" && doctor && (
                <Panel>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>STAFF MEMBER</th>
                          <th>USERNAME</th>
                          <th>ROLE</th>
                          <th>STATUS</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.username}</td>
                            <td>
                              {u.role === "doctor" ? "Doctor" : "Front desk"}
                            </td>
                            <td>
                              <Status
                                value={u.active ? "active" : "disabled"}
                              />
                            </td>
                            <td>
                              <button
                                className="button"
                                onClick={() =>
                                  setModal({ kind: "user-edit", account: u })
                                }
                              >
                                {u.protected && demo ? "View access" : "Manage"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              {page === "audit" && doctor && (
                <Panel
                  title="Access and change history"
                  subtitle="Latest 200 events. Clinical revisions are stored with each visit."
                >
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>TIME</th>
                          <th>STAFF MEMBER</th>
                          <th>ACTION</th>
                          <th>RECORD TYPE</th>
                          <th>DETAIL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((a) => (
                          <tr key={a.id}>
                            <td>
                              {dateText(a.createdAt)}
                              <span className="cell-sub">
                                {timeText(a.createdAt)}
                              </span>
                            </td>
                            <td>{a.actorName || "System"}</td>
                            <td>{a.action.replaceAll("_", " ")}</td>
                            <td>{a.entity.replaceAll("_", " ")}</td>
                            <td>
                              <small>
                                {a.entityId.slice(0, 8)}
                                {Object.keys(a.metadata).length > 0
                                  ? " / " + JSON.stringify(a.metadata)
                                  : ""}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              {page === "settings" && (
                <div className="detail-grid">
                  <Panel
                    title="Doctor availability"
                    subtitle="Jamaica time. Monday is day 1."
                  >
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>DOCTOR</th>
                            <th>DAY</th>
                            <th>HOURS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hours?.hours.map((h) => (
                            <tr key={h.doctorId + h.weekday}>
                              <td>{h.doctorName}</td>
                              <td>
                                {
                                  [
                                    "",
                                    "Monday",
                                    "Tuesday",
                                    "Wednesday",
                                    "Thursday",
                                    "Friday",
                                    "Saturday",
                                    "Sunday",
                                  ][h.weekday]
                                }
                              </td>
                              <td>
                                {String(Math.floor(h.startMin / 60)).padStart(
                                  2,
                                  "0",
                                )}
                                :{String(h.startMin % 60).padStart(2, "0")} to{" "}
                                {String(Math.floor(h.endMin / 60)).padStart(
                                  2,
                                  "0",
                                )}
                                :{String(h.endMin % 60).padStart(2, "0")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {doctor && (
                      <div className="panel-body action-row">
                        <button
                          className="button"
                          onClick={() => setModal({ kind: "hours" })}
                        >
                          Change hours
                        </button>
                        <button
                          className="button"
                          onClick={() => setModal({ kind: "block" })}
                        >
                          Block time
                        </button>
                      </div>
                    )}
                    {hours?.blocks.map((b) => (
                      <div className="timeline-item" key={b.id}>
                        <strong>{b.doctorName}</strong>
                        <p>
                          {dateText(b.startAt)} / {timeText(b.startAt)} to{" "}
                          {timeText(b.endAt)}
                        </p>
                        {doctor && (
                          <button
                            className="text-button"
                            onClick={() =>
                              act(
                                () => api("blocks/" + b.id, {}),
                                "Time block removed.",
                              )
                            }
                          >
                            Remove block
                          </button>
                        )}
                      </div>
                    ))}
                  </Panel>
                  <div className="stack">
                    <Panel title="Your account">
                      <div className="panel-body">
                        <p>
                          <strong>{actor.name}</strong>
                        </p>
                        <p className="muted">
                          {actor.username} / {doctor ? "Doctor" : "Front desk"}
                        </p>
                        <button
                          className="button"
                          style={{ marginTop: 20 }}
                          onClick={() => setModal({ kind: "password" })}
                        >
                          <LockKeyhole size={16} />
                          Change password
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            act(async () => {
                              await api("logout", {});
                              window.location.href = "/login";
                            }, "Logged out.")
                          }
                        >
                          Log out
                        </button>
                      </div>
                    </Panel>
                    <Panel title="Recovery and support">
                      <div className="panel-body">
                        <p className="muted">
                          Database backups are separate from patient reports.
                          The group start guide explains the operator backup and
                          restore commands.
                        </p>
                        <p className="note-box" style={{ marginTop: 16 }}>
                          Course demo only. Human training and acceptance remain
                          pending.
                        </p>
                      </div>
                    </Panel>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 3).map((n) => (
          <Link
            key={n.id}
            href={"/app/" + (n.id === "overview" ? "" : n.id)}
            className={page === n.id ? "active" : ""}
          >
            <n.icon size={20} />
            {n.label}
          </Link>
        ))}
        <button
          onClick={() => setMobileMenu(!mobileMenu)}
          aria-expanded={mobileMenu}
          aria-label="More navigation"
        >
          <MoreHorizontal size={22} />
          More
        </button>
      </nav>
      {mobileMenu && (
        <div className="mobile-menu-panel">
          {[...nav.slice(3), ...admin].map((n) => (
            <Link key={n.id} href={"/app/" + n.id}>
              <n.icon size={18} />
              {n.label}
            </Link>
          ))}
        </div>
      )}
      {toast && (
        <div
          role="status"
          className={"toast " + (toast.startsWith("Error:") ? "error" : "")}
        >
          {toast}
        </div>
      )}
      {modal && (
        <Dialog
          title={
            (
              {
                patient: modal.patient
                  ? "Edit patient details"
                  : "Register patient",
                appointment: modal.appointment
                  ? "Reschedule appointment"
                  : "Book appointment",
                "appointment-actions": "Appointment actions",
                invoice: "Create manual invoice",
                void: "Void invoice",
                user: "Add staff account",
                "user-edit": "Manage staff access",
                visit: "Start walk-in visit",
                password: "Change your password",
                archive: modal.patient?.archived
                  ? "Restore patient record"
                  : "Archive patient record",
                reconcile: "Link provisional record",
                document: "Add private diagnostic report",
                hours: "Change doctor hours",
                block: "Block doctor time",
              } as Record<string, string>
            )[modal.kind]
          }
          close={() => setModal(null)}
        >
          {modal.kind === "patient" && (
            <PatientForm patient={modal.patient} done={done} />
          )}
          {modal.kind === "appointment" && (
            <BookingForm
              patients={patients}
              doctors={doctors}
              patient={modal.patient}
              appointment={modal.appointment}
              done={() => done("Appointment confirmed.")}
            />
          )}
          {modal.kind === "appointment-actions" && modal.appointment && (
            <div className="clinical-form">
              <p>
                {modal.appointment.firstName} {modal.appointment.lastName} /{" "}
                {dateText(modal.appointment.startAt)} at{" "}
                {timeText(modal.appointment.startAt)}
              </p>
              <Status value={modal.appointment.status} />
              {modal.appointment.status === "confirmed" && (
                <>
                  <button
                    className="button primary"
                    onClick={() =>
                      act(async () => {
                        await api(
                          `appointments/${modal.appointment!.id}/status`,
                          {
                            version: modal.appointment!.version,
                            status: "arrived",
                          },
                        );
                        setModal(null);
                      }, "Arrival recorded.")
                    }
                  >
                    Mark arrived
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      setModal({
                        kind: "appointment",
                        appointment: modal.appointment,
                      })
                    }
                  >
                    Reschedule
                  </button>
                  <Form
                    label="Cancel appointment"
                    submit={async () => {
                      await api(
                        `appointments/${modal.appointment!.id}/status`,
                        {
                          version: modal.appointment!.version,
                          status: "cancelled",
                        },
                      );
                      done("Appointment cancelled.");
                    }}
                  >
                    <p className="note-box">
                      Cancel this appointment and release the time slot? The
                      booking history will remain.
                    </p>
                  </Form>
                </>
              )}
              {["confirmed", "arrived"].includes(modal.appointment.status) && (
                <button
                  className="button"
                  onClick={() =>
                    act(async () => {
                      await api("visits", {
                        patientId: modal.appointment!.patientId,
                        doctorId: modal.appointment!.doctorId,
                        appointmentId: modal.appointment!.id,
                      });
                      const p = modal.appointment!.patientId;
                      setModal(null);
                      router.push("/app/patients/" + p);
                    }, "Visit started.")
                  }
                >
                  Start visit
                </button>
              )}
            </div>
          )}
          {modal.kind === "visit" && (
            <Form
              label="Start visit"
              submit={async (d) => {
                await api("visits", {
                  patientId: field(d, "patientId"),
                  doctorId: field(d, "doctorId"),
                });
                done("Visit started.", field(d, "patientId"));
              }}
            >
              <PatientSelect patients={patients} selected={modal.patient} />
              <label>
                Doctor
                <select name="doctorId" required>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="note-box">
                This starts a walk-in record. It does not reserve an appointment
                slot.
              </p>
            </Form>
          )}
          {modal.kind === "invoice" && (
            <Form
              label="Create invoice draft"
              submit={async (d) => {
                const lines = [1, 2, 3]
                  .filter((i) => field(d, "description" + i))
                  .map((i) => ({
                    description: field(d, "description" + i),
                    quantity: Number(field(d, "quantity" + i)),
                    unitCents: Math.round(Number(field(d, "unit" + i)) * 100),
                  }));
                await api("invoices", {
                  patientId: field(d, "patientId"),
                  lines,
                });
                done("Invoice draft created.");
              }}
            >
              <PatientSelect patients={patients} selected={modal.patient} />
              <p className="note-box">
                Enter service charges in JMD. This records an invoice, not a
                payment.
              </p>
              {[1, 2, 3].map((i) => (
                <div className="form-grid" key={i}>
                  <label className="full">
                    Service {i}
                    {i > 1 ? " (optional)" : ""}
                    <input
                      name={"description" + i}
                      maxLength={200}
                      required={i === 1}
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      name={"quantity" + i}
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      defaultValue="1"
                    />
                  </label>
                  <label>
                    Unit charge (JMD)
                    <input
                      name={"unit" + i}
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue="0"
                    />
                  </label>
                </div>
              ))}
            </Form>
          )}
          {modal.kind === "void" && modal.invoice && (
            <Form
              label="Void invoice"
              submit={async (d) => {
                await api("invoices/" + modal.invoice!.id, {
                  version: modal.invoice!.version,
                  status: "void",
                  reason: field(d, "reason"),
                });
                done("Invoice voided. Its record was kept.");
              }}
            >
              <p>
                {modal.invoice.number} / {money(modal.invoice.totalCents)}
              </p>
              <label>
                Reason
                <textarea name="reason" required maxLength={500} />
              </label>
            </Form>
          )}
          {modal.kind === "user" && (
            <Form
              label="Create account"
              submit={async (d) => {
                await api("users", Object.fromEntries(d));
                done("Staff account created.");
              }}
            >
              <label>
                Full name
                <input name="name" maxLength={100} required />
              </label>
              <label>
                Username
                <input
                  name="username"
                  pattern="[a-z0-9._-]{3,40}"
                  autoCapitalize="none"
                  required
                />
              </label>
              <label>
                Role
                <select name="role">
                  <option value="front_desk">Front desk</option>
                  <option value="doctor">Doctor</option>
                </select>
              </label>
              <label>
                Initial password
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  required
                  autoComplete="new-password"
                />
              </label>
              <p className="field-help">
                Use at least 12 characters. Share credentials through a private
                channel.
              </p>
            </Form>
          )}
          {modal.kind === "user-edit" &&
            modal.account &&
            (modal.account.protected && demo ? (
              <p className="note-box">
                This supplied demo account is protected. It cannot be changed or
                disabled. Create a separate fictional account to test account
                management.
              </p>
            ) : (
              <Form
                label="Save access changes"
                submit={async (d) => {
                  await api("users/" + modal.account!.id, {
                    version: modal.account!.version,
                    role: field(d, "role"),
                    active: field(d, "active") === "true",
                    ...(field(d, "password")
                      ? { password: field(d, "password") }
                      : {}),
                  });
                  done(
                    "Account access updated. Existing sessions were closed.",
                  );
                }}
              >
                <p>
                  {modal.account.name} / {modal.account.username}
                </p>
                <label>
                  Role
                  <select name="role" defaultValue={modal.account.role}>
                    <option value="front_desk">Front desk</option>
                    <option value="doctor">Doctor</option>
                  </select>
                </label>
                <label>
                  Access
                  <select
                    name="active"
                    defaultValue={String(modal.account.active)}
                  >
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <label>
                  Reset password (optional)
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </Form>
            ))}
          {modal.kind === "password" &&
            (actor.protected && demo ? (
              <p className="note-box">
                The supplied demo password is protected. A separate fictional
                account can test password changes.
              </p>
            ) : (
              <Form
                label="Change password and log out"
                submit={async (d) => {
                  await api("password", Object.fromEntries(d));
                  window.location.href = "/login";
                }}
              >
                <label>
                  Current password
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </label>
              </Form>
            ))}
          {modal.kind === "archive" && modal.patient && (
            <Form
              label={
                modal.patient.archived ? "Restore record" : "Archive record"
              }
              submit={async () => {
                await api("patients/" + modal.patient!.id + "/archive", {
                  version: modal.patient!.version,
                  archived: !modal.patient!.archived,
                });
                done("Patient status updated.");
              }}
            >
              <p className="note-box">
                The patient history will remain available.{" "}
                {modal.patient.archived
                  ? "The record will become active again."
                  : "New bookings will be blocked for this record."}
              </p>
            </Form>
          )}
          {modal.kind === "reconcile" && modal.patient && (
            <Form
              label="Link records"
              submit={async (d) => {
                await api("patients/" + modal.patient!.id + "/reconcile", {
                  targetId: field(d, "targetId"),
                  reason: field(d, "reason"),
                });
                done("Provisional record linked. Earlier history was kept.");
              }}
            >
              <PatientSelect
                patients={patients}
                name="targetId"
                label="Primary record"
                excludeId={modal.patient.id}
              />
              <label>
                Reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={500}
                  required
                />
              </label>
              <p className="note-box">
                This keeps both MRNs and their history. The provisional record
                links to the primary record.
              </p>
            </Form>
          )}
          {modal.kind === "document" && (
            <Form
              label="Store private report"
              submit={async (d) => {
                await api("documents", d);
                done("Private report stored.");
              }}
            >
              <PatientSelect patients={patients} selected={modal.patient} />
              <label>
                Report title
                <input name="title" maxLength={160} required />
              </label>
              <label>
                Report type
                <select name="kind">
                  <option>Lab report</option>
                  <option>Diagnostic report</option>
                </select>
              </label>
              <label>
                Replaces document ID (optional)
                <input
                  name="replacesId"
                  defaultValue={modal.replacesId}
                  placeholder="Keep blank for a new report"
                />
              </label>
              <label>
                Report file
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  required
                />
              </label>
              <p className="note-box">
                Maximum 4 MiB. Earlier reports stay available.{" "}
                {demo && (
                  <>
                    Use only the{" "}
                    <a className="text-button" href="/api/sample-report">
                      fictional sample report
                    </a>
                    .
                  </>
                )}
              </p>
            </Form>
          )}
          {modal.kind === "hours" && (
            <Form
              label="Save hours"
              submit={async (d) => {
                const start = field(d, "start").split(":").map(Number),
                  end = field(d, "end").split(":").map(Number);
                await api("hours", {
                  doctorId: field(d, "doctorId"),
                  weekday: Number(field(d, "weekday")),
                  startMin: start[0] * 60 + start[1],
                  endMin: end[0] * 60 + end[1],
                });
                done("Doctor hours updated.");
              }}
            >
              <label>
                Doctor
                <select name="doctorId">
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Day
                <select name="weekday">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((v, i) => (
                    <option key={v} value={i + 1}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Start
                  <input
                    name="start"
                    type="time"
                    defaultValue="08:00"
                    required
                  />
                </label>
                <label>
                  End
                  <input name="end" type="time" defaultValue="17:00" required />
                </label>
              </div>
              <p className="note-box">
                Move any conflicting future appointments before reducing hours.
              </p>
            </Form>
          )}
          {modal.kind === "block" && (
            <Form
              label="Block time"
              submit={async (d) => {
                await api("blocks", {
                  doctorId: field(d, "doctorId"),
                  startAt: field(d, "start") + ":00-05:00",
                  endAt: field(d, "end") + ":00-05:00",
                });
                done("Time blocked.");
              }}
            >
              <label>
                Doctor
                <select name="doctorId">
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start (Jamaica time)
                <input name="start" type="datetime-local" required />
              </label>
              <label>
                End (Jamaica time)
                <input name="end" type="datetime-local" required />
              </label>
            </Form>
          )}
        </Dialog>
      )}
    </div>
  );
}
function DocumentCards({
  docs,
  onReplace,
}: {
  docs: Doc[];
  onReplace?: (doc: Doc) => void;
}) {
  return docs.length ? (
    <div className="document-list">
      {docs.map((d) => (
        <article className="document-card" key={d.id}>
          <FileText size={26} strokeWidth={1.5} />
          <h3>{d.title}</h3>
          <p>
            {d.firstName ? d.firstName + " " + d.lastName + " / " : ""}
            {d.kind}
          </p>
          <small>
            {dateText(d.createdAt)} / {(d.size / 1024).toFixed(1)} KiB
            {d.replacesId ? " / Replacement, earlier file kept" : ""}
          </small>
          <a className="button" href={"/api/documents/" + d.id}>
            <Download size={14} />
            Retrieve report
          </a>
          {onReplace && (
            <button
              className="text-button"
              onClick={() => {
                onReplace(d);
              }}
            >
              Add replacement
            </button>
          )}
        </article>
      ))}
    </div>
  ) : (
    <Panel>
      <Empty title="No diagnostic reports yet.">
        Add a private report to this patient record.
      </Empty>
    </Panel>
  );
}
function PatientReportSelect({ patients }: { patients: Patient[] }) {
  const [id, setId] = useState(patients[0]?.id || "");
  return (
    <>
      <PatientSelect
        patients={patients}
        selected={patients[0]}
        onChange={setId}
        includeArchived
      />
      {id && <PrintLink type="history" id={id} label="Open patient report" />}
    </>
  );
}
