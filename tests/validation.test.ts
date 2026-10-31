import { describe, it, expect } from "vitest";
import {
  patientInput,
  appointmentInput,
  clinicalInput,
  invoiceInput,
  invoiceTotal,
  fileMime,
  userInput,
} from "../src/lib/validation";
const patient = {
  firstName: "Test",
  lastName: "Fictional",
  dob: "2000-02-29",
  phone: "876-555-0100",
  address: "1 Sample Road",
};
describe("patient partitions and date boundaries", () => {
  it("accepts a valid leap day", () =>
    expect(patientInput.safeParse(patient).success).toBe(true));
  it.each(["2001-02-29", "2025-02-30", "2100-01-01", "not-a-date", ""])(
    "rejects invalid or future date %s",
    (dob) =>
      expect(patientInput.safeParse({ ...patient, dob }).success).toBe(false),
  );
  it("accepts today as a date of birth", () =>
    expect(
      patientInput.safeParse({
        ...patient,
        dob: new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Jamaica",
        }).format(new Date()),
      }).success,
    ).toBe(true));
  it.each([0, 81])("rejects name length %i", (n) =>
    expect(
      patientInput.safeParse({ ...patient, firstName: "a".repeat(n) }).success,
    ).toBe(false),
  );
  it.each([1, 80])("accepts name length %i", (n) =>
    expect(
      patientInput.safeParse({ ...patient, firstName: "a".repeat(n) }).success,
    ).toBe(true),
  );
  it.each(["123456", "letterphone", ""])("rejects invalid phone %s", (phone) =>
    expect(patientInput.safeParse({ ...patient, phone }).success).toBe(false),
  );
});
describe("appointment boundaries", () => {
  const base = {
    patientId: "11111111-1111-4111-8111-111111111111",
    doctorId: "22222222-2222-4222-8222-222222222222",
    startAt: "2035-01-01T08:00:00-05:00",
  };
  it("accepts a valid interval", () =>
    expect(
      appointmentInput.safeParse({
        ...base,
        endAt: "2035-01-01T08:30:00-05:00",
      }).success,
    ).toBe(true));
  it.each([
    "2035-01-01T08:00:00-05:00",
    "2035-01-01T07:59:00-05:00",
    "2035-01-01T12:01:00-05:00",
  ])("rejects zero, negative, or excessive interval %s", (endAt) =>
    expect(appointmentInput.safeParse({ ...base, endAt }).success).toBe(false),
  );
  it("accepts the maximum four hour interval", () =>
    expect(
      appointmentInput.safeParse({
        ...base,
        endAt: "2035-01-01T12:00:00-05:00",
      }).success,
    ).toBe(true));
  it("rejects past appointments", () =>
    expect(
      appointmentInput.safeParse({
        ...base,
        startAt: "2000-01-01T08:00:00Z",
        endAt: "2000-01-01T08:30:00Z",
      }).success,
    ).toBe(false));
});
describe("clinical and invoice rules", () => {
  it("permits incomplete drafts", () =>
    expect(
      clinicalInput.safeParse({ expectedRevision: 0, state: "draft" }).success,
    ).toBe(true));
  it("requires diagnosis for final entries", () =>
    expect(
      clinicalInput.safeParse({ expectedRevision: 0, state: "final" }).success,
    ).toBe(false));
  it("does not fill medication details", () =>
    expect(
      clinicalInput.safeParse({
        expectedRevision: 0,
        state: "draft",
        medications: [{ medication: "Sample" }],
      }).success,
    ).toBe(false));
  it("calculates exact integer cents", () =>
    expect(
      invoiceTotal([{ description: "Sample", quantity: 3, unitCents: 101 }]),
    ).toBe(303));
  it.each([0, -1, 1.5])("rejects invalid invoice quantity %s", (quantity) =>
    expect(
      invoiceInput.safeParse({
        patientId: "11111111-1111-4111-8111-111111111111",
        lines: [{ description: "Sample", quantity, unitCents: 100 }],
      }).success,
    ).toBe(false),
  );
  it("rejects empty invoices", () =>
    expect(
      invoiceInput.safeParse({
        patientId: "11111111-1111-4111-8111-111111111111",
        lines: [],
      }).success,
    ).toBe(false));
  it("rejects a total above the database bound", () =>
    expect(() =>
      invoiceTotal([
        { description: "Sample", quantity: 1000, unitCents: 100000000 },
      ]),
    ).toThrow());
  it.each(["front_desk", "doctor"])("accepts the defined role %s", (role) =>
    expect(
      userInput.safeParse({
        username: "testuser",
        name: "Test User",
        role,
        password: "abcdefghijkl",
      }).success,
    ).toBe(true),
  );
  it("rejects an injected role", () =>
    expect(
      userInput.safeParse({
        username: "testuser",
        name: "Test User",
        role: "admin",
        password: "abcdefghijkl",
      }).success,
    ).toBe(false));
  it("rejects a short password", () =>
    expect(
      userInput.safeParse({
        username: "testuser",
        name: "Test User",
        role: "doctor",
        password: "abcdefghijk",
      }).success,
    ).toBe(false));
});
describe("file signature partitions", () => {
  it("recognises PDF", () =>
    expect(fileMime(Buffer.from("%PDF-1.4"))).toBe("application/pdf"));
  it("recognises PNG", () =>
    expect(fileMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "image/png",
    ));
  it("recognises JPEG", () =>
    expect(fileMime(Buffer.from([255, 216, 255]))).toBe("image/jpeg"));
  it.each(["", "<script>alert(1)</script>", "not a PDF"])(
    "rejects an unapproved signature",
    (s) => expect(fileMime(Buffer.from(s))).toBeNull(),
  );
});
