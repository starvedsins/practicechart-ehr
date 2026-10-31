import "dotenv/config";
import { Pool } from "pg";
import { hashPassword } from "../src/lib/auth";
import { emptyClinical } from "../src/lib/validation";
import { samplePdf, storeFile } from "../src/lib/storage";
const target = new URL(
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!,
);
if (!/^practicechart[_a-z0-9]+$/.test(target.pathname.slice(1)))
  throw Error("Fictional seeding requires a separate PracticeChart database.");
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
});
const existing = await pool.query("SELECT count(*) FROM patients");
if (Number(existing.rows[0].count) > 0) {
  console.log("Seed skipped. Existing records are preserved.");
  await pool.end();
  process.exit(0);
}
const protectedAccount = process.env.DEMO_MODE === "true";
const doctor = (
  await pool.query(
    "INSERT INTO users(username,name,role,password_hash,protected) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [
      "doctor",
      "Dr. Maya Bennett",
      "doctor",
      await hashPassword("DoctorDemo!2026"),
      protectedAccount,
    ],
  )
).rows[0].id;
await pool.query(
  "INSERT INTO users(username,name,role,password_hash,protected) VALUES($1,$2,$3,$4,$5)",
  [
    "frontdesk",
    "Jordan Ellis",
    "front_desk",
    await hashPassword("DeskDemo!2026"),
    protectedAccount,
  ],
);
await pool.query(
  "INSERT INTO doctor_hours(doctor_id,weekday,start_min,end_min) SELECT $1,n,480,1020 FROM generate_series(1,5)n",
  [doctor],
);
const names = [
  ["Lena", "Campbell"],
  ["Noah", "Sterling"],
  ["Amara", "Ellis"],
  ["Theo", "Morgan"],
  ["Isla", "Reid"],
  ["Eli", "Brooks"],
  ["Mila", "Grant"],
  ["Jude", "Foster"],
  ["Zoe", "Palmer"],
  ["Owen", "Hart"],
  ["Nia", "Clarke"],
  ["Leo", "Hayes"],
];
const ids: string[] = [];
for (let i = 0; i < names.length; i++) {
  const r = await pool.query(
    "INSERT INTO patients(first_name,last_name,dob,phone,address,gender,emergency_contact) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [
      ...names[i],
      `${1984 + i}-05-${String(10 + i).padStart(2, "0")}`,
      "876-555-01" + String(i).padStart(2, "0"),
      `${i + 1} Sample Lane, Demo Town`,
      "Not stated",
      "Fictional contact: 876-555-0199",
    ],
  );
  ids.push(r.rows[0].id);
}
let day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Jamaica",
}).format(new Date());
const d = new Date(day + "T12:00:00-05:00");
if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
  d.setUTCDate(d.getUTCDate() + (d.getUTCDay() === 6 ? 2 : 1));
  day = d.toISOString().slice(0, 10);
}
for (let i = 0; i < 5; i++)
  await pool.query(
    "INSERT INTO appointments(patient_id,doctor_id,start_at,end_at,status) VALUES($1,$2,$3,$4,$5)",
    [
      ids[i],
      doctor,
      `${day}T${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}:00-05:00`,
      `${day}T${String(9 + Math.floor((i + 1) / 2)).padStart(2, "0")}:${i % 2 ? "00" : "30"}:00-05:00`,
      i === 0 ? "completed" : i === 1 ? "arrived" : "confirmed",
    ],
  );
for (let i = 0; i < 3; i++) {
  const status = i === 0 ? "filed" : i === 1 ? "ready" : "open";
  const v = (
    await pool.query(
      "INSERT INTO visits(patient_id,doctor_id,status,revision,visit_at,filed_at) VALUES($1,$2,$3,$4,now()-make_interval(days=>$5),CASE WHEN $3='filed' THEN now() ELSE NULL END) RETURNING id",
      [ids[i], doctor, status, i === 2 ? 0 : 1, i + 1],
    )
  ).rows[0].id;
  if (i < 2)
    await pool.query(
      "INSERT INTO clinical_revisions(visit_id,revision,author_id,state,content) VALUES($1,1,$2,'final',$3)",
      [
        v,
        doctor,
        JSON.stringify({
          ...emptyClinical,
          symptoms: "Fictional follow-up visit.",
          notes: "Sample record for course demonstration only.",
          diagnosis: "Sample diagnosis entered by the demonstration doctor.",
          treatment: "Sample treatment record. Not medical advice.",
          allergies: "Not recorded in this fictional case.",
          certificate:
            "This fictional certificate shows the document format only.",
        }),
      ],
    );
}
await pool.query(
  "INSERT INTO invoices(patient_id,lines,total_cents,status) VALUES($1,$2,350000,'issued')",
  [
    ids[0],
    JSON.stringify([
      { description: "Sample consultation", quantity: 1, unitCents: 350000 },
    ]),
  ],
);
const file = await storeFile(samplePdf, "application/pdf");
await pool.query(
  "INSERT INTO documents(patient_id,title,kind,pathname,mime,size,sha256,author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
  [
    ids[0],
    "Fictional lab report",
    "Lab report",
    file.pathname,
    file.mime,
    file.size,
    file.sha256,
    doctor,
  ],
);
await pool.query(
  "INSERT INTO audit_events(actor_id,action,entity,metadata) VALUES($1,'seed','demo','{\"fictional\":true}')",
  [doctor],
);
await pool.end();
console.log(
  "Fictional seed complete. doctor / DoctorDemo!2026 and frontdesk / DeskDemo!2026",
);
