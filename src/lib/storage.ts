import { put, get } from "@vercel/blob";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileMime } from "./validation";
import { AppError } from "./auth";
function makeSamplePdf() {
  const stream =
    "BT /F1 18 Tf 50 720 Td (PracticeChart fictional lab report) Tj 0 -30 Td /F1 12 Tf (Sample only. No clinical findings.) Tj ET";
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${Buffer.byteLength(stream)}>>\nstream\n${stream}\nendstream`,
  ];
  let data = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(data));
    data += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(data);
  data += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join("\n")}\ntrailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}
export const samplePdf = makeSamplePdf();
export async function storeFile(bytes: Buffer, claimedMime: string) {
  if (bytes.length < 1 || bytes.length > 4194304)
    throw new AppError(400, "Use a file from 1 byte to 4 MiB.");
  const mime = fileMime(bytes);
  if (!mime || mime !== claimedMime)
    throw new AppError(
      400,
      "Use a PDF, PNG, or JPEG file with a matching file type.",
    );
  if (process.env.DEMO_MODE === "true" && !bytes.equals(samplePdf))
    throw new AppError(
      400,
      "The public demo accepts only the supplied sample report.",
    );
  const pathname = `practicechart/${process.env.VERCEL_ENV === "preview" ? "preview" : "records"}/${randomUUID()}`;
  if (process.env.STORAGE_DRIVER === "blob") {
    await put(pathname, bytes, {
      access: "private",
      contentType: mime,
      addRandomSuffix: false,
    });
  } else {
    const root = path.resolve(
      /* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_DIR ||
        ".private/uploads",
    );
    await mkdir(path.dirname(path.join(root, pathname)), { recursive: true });
    await writeFile(path.join(root, pathname), bytes, { flag: "wx" });
  }
  return {
    pathname,
    mime,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function readPrivateFile(pathname: string) {
  if (!/^practicechart\/(records|preview)\/[a-f0-9-]{36}$/.test(pathname))
    throw new AppError(404, "The file was not found.");
  try {
    if (process.env.STORAGE_DRIVER === "blob") {
      const r = await get(pathname, { access: "private" });
      if (!r || r.statusCode !== 200) throw new Error("Missing");
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    }
    return await readFile(
      /* turbopackIgnore: true */ path.join(
        path.resolve(
          /* turbopackIgnore: true */ process.env.PRIVATE_STORAGE_DIR ||
            ".private/uploads",
        ),
        pathname,
      ),
    );
  } catch {
    throw new AppError(
      404,
      "The stored file is not available. Contact the practice operator.",
    );
  }
}
