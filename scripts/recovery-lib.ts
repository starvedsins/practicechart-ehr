import "dotenv/config";
import { spawn } from "node:child_process";
import {
  generateKeyPairSync,
  randomBytes,
  publicEncrypt,
  privateDecrypt,
  createCipheriv,
  createDecipheriv,
  constants,
  createHash,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCACertificates } from "node:tls";
export async function pgTool(
  tool: "pg_dump" | "pg_restore",
  url: string,
  args: string[],
  input?: Buffer,
) {
  const u = new URL(url);
  const docker =
    process.env.PGTOOLS_DRIVER === "docker" || process.platform === "win32";
  const remote = !["localhost", "127.0.0.1"].includes(u.hostname);
  const trustFile = path.resolve(".private/backup-trust.pem");
  if (docker && remote) {
    await mkdir(".private", { recursive: true });
    await writeFile(trustFile, getCACertificates("default").join("\n"));
  }
  const env = {
    ...process.env,
    PGHOST:
      docker && ["localhost", "127.0.0.1"].includes(u.hostname)
        ? "host.docker.internal"
        : u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1),
    PGSSLROOTCERT: remote ? (docker ? "/practicechart-ca.pem" : "system") : "",
    PGSSLMODE: ["localhost", "127.0.0.1"].includes(u.hostname)
      ? "disable"
      : "verify-full",
  };
  if (tool === "pg_restore")
    args = ["--dbname=" + u.pathname.slice(1), ...args];
  const binary = docker ? "docker" : tool;
  const command = docker
    ? [
        "run",
        "--rm",
        "-i",
        "-e",
        "PGHOST",
        "-e",
        "PGPORT",
        "-e",
        "PGUSER",
        "-e",
        "PGPASSWORD",
        "-e",
        "PGDATABASE",
        "-e",
        "PGSSLMODE",
        "-e",
        "PGSSLROOTCERT",
        ...(remote
          ? [
              "--mount",
              `type=bind,source=${trustFile},target=/practicechart-ca.pem,readonly`,
            ]
          : []),
        "postgres:18",
        tool,
        ...args,
      ]
    : args;
  return await new Promise<Buffer>((resolve, reject) => {
    const p = spawn(binary, command, { env, windowsHide: true });
    const chunks: Buffer[] = [];
    let diagnostic = "";
    p.stdout.on("data", (c) => chunks.push(c));
    p.stderr.on("data", (part) => {
      diagnostic += part.toString();
    });
    p.on("error", () => reject(Error(`${tool} could not start.`)));
    p.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(
            Error(
              `${tool} failed with code ${code}. Connection details were not logged. ${diagnostic.replaceAll(env.PGPASSWORD, "[redacted]").replaceAll(env.PGHOST, "[host]").replaceAll(env.PGUSER, "[user]").slice(0, 800)}`,
            ),
          ),
    );
    p.stdin.end(input);
  });
}
export async function recoveryKeys() {
  const root = ".private";
  await mkdir(root, { recursive: true });
  let publicKey: string;
  try {
    publicKey = await readFile(path.join(root, "recovery.pub"), "utf8");
  } catch {
    const keys = generateKeyPairSync("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    await writeFile(path.join(root, "recovery.key"), keys.privateKey, {
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(path.join(root, "recovery.pub"), keys.publicKey, {
      flag: "wx",
    });
    publicKey = keys.publicKey;
  }
  return publicKey;
}
export function encryptBundle(input: Buffer, publicKey: string) {
  const key = randomBytes(32),
    iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(input)), cipher.final()]);
  const wrapped = publicEncrypt(
    {
      key: publicKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    key,
  );
  const metadata = Buffer.from(
    JSON.stringify({
      format: "PracticeChart full EHR recovery v1",
      key: wrapped.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    }),
  );
  const size = Buffer.alloc(4);
  size.writeUInt32BE(metadata.length);
  return Buffer.concat([Buffer.from("PCBACKUP1"), size, metadata, body]);
}
export function decryptBundle(input: Buffer, privateKey: string) {
  if (input.subarray(0, 9).toString() !== "PCBACKUP1")
    throw Error("Unknown recovery format.");
  const size = input.readUInt32BE(9);
  const meta = JSON.parse(input.subarray(13, 13 + size).toString());
  const key = privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(meta.key, "base64"),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(meta.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(meta.tag, "base64"));
  return gunzipSync(
    Buffer.concat([
      decipher.update(input.subarray(13 + size)),
      decipher.final(),
    ]),
  );
}
export const sha = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
