import { z } from "zod";
export const idSchema = z.string().uuid();
const text = (max = 200) =>
  z.string().trim().min(1, "This field is required.").max(max);
export const patientInput = z.object({
  firstName: text(80),
  lastName: text(80),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((s) => {
      const d = new Date(s + "T12:00:00Z");
      return (
        !Number.isNaN(d.valueOf()) &&
        d.toISOString().slice(0, 10) === s &&
        s <=
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Jamaica",
          }).format(new Date())
      );
    }, "Use a valid date of birth that is not in the future."),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+0-9 ()-]+$/, "Use a valid phone number."),
  address: text(300),
  gender: z
    .enum(["Not stated", "Female", "Male", "Other"])
    .default("Not stated"),
  emergencyContact: z.string().trim().max(200).default(""),
  insurance: z.string().trim().max(100).default(""),
  provisionalReason: z.string().trim().max(500).default(""),
});
export const appointmentInput = z
  .object({
    patientId: idSchema,
    doctorId: idSchema,
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
  })
  .refine(
    (v) =>
      Date.parse(v.endAt) - Date.parse(v.startAt) >= 60000 &&
      Date.parse(v.endAt) - Date.parse(v.startAt) <= 14400000,
    "Use an appointment length from 1 minute to 4 hours.",
  )
  .refine(
    (v) => Date.parse(v.startAt) > Date.now(),
    "Choose a future appointment.",
  );
export const medicationInput = z.object({
  medication: text(150),
  dosage: text(100),
  route: text(80),
  frequency: text(100),
  duration: text(100),
  quantity: text(80),
  instructions: z.string().trim().max(500).default(""),
});
export const clinicalInput = z
  .object({
    expectedRevision: z.number().int().min(0),
    state: z.enum(["draft", "final"]),
    symptoms: z.string().trim().max(8000).default(""),
    notes: z.string().trim().max(12000).default(""),
    diagnosis: z.string().trim().max(4000).default(""),
    treatment: z.string().trim().max(8000).default(""),
    allergies: z.string().trim().max(2000).default(""),
    vitals: z.string().trim().max(2000).default(""),
    labResults: z.string().trim().max(6000).default(""),
    medications: z.array(medicationInput).max(20).default([]),
    certificate: z.string().trim().max(6000).default(""),
    reason: z.string().trim().max(1000).default(""),
  })
  .refine(
    (v) => v.state !== "final" || Boolean(v.diagnosis),
    "Enter a diagnosis before you complete this visit.",
  );
export const invoiceInput = z.object({
  patientId: idSchema,
  lines: z
    .array(
      z.object({
        description: text(200),
        quantity: z.number().int().min(1).max(1000),
        unitCents: z.number().int().min(0).max(100000000),
      }),
    )
    .min(1)
    .max(30),
});
export function invoiceTotal(lines: z.infer<typeof invoiceInput>["lines"]) {
  const total = lines.reduce((n, l) => n + l.quantity * l.unitCents, 0);
  if (!Number.isSafeInteger(total) || total > 2000000000)
    throw new Error("Invoice total is too large.");
  return total;
}
export const userInput = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  name: text(100),
  role: z.enum(["doctor", "front_desk"]),
  password: z.string().min(12).max(128),
});
export type ClinicalContent = Omit<
  z.infer<typeof clinicalInput>,
  "expectedRevision" | "state" | "reason"
>;
export const emptyClinical: ClinicalContent = {
  symptoms: "",
  notes: "",
  diagnosis: "",
  treatment: "",
  allergies: "",
  vitals: "",
  labResults: "",
  medications: [],
  certificate: "",
};
export function fileMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  return null;
}
