// Anis key enrolment — run ONCE on the admin's PC with the details from Anis's invitation email.
//   ANIS_AUTHORITY=https://… ANIS_INVITATION_ID=… ANIS_ENROLLMENT_TOKEN=… node scripts/anis-enrol.mjs
//   node scripts/anis-enrol.mjs status        (re-check approval later; reads the saved state)
// The private key is generated HERE and saved outside the repo (~/.anis/). Only the public half is sent.
// Prints the SAFETY CODE (XXXX-XXXX-XXXX-XXXX) you read to Anis staff on the phone.
import { AnisEnrollmentClient, PemP256Signer } from "@anis-ly/partners";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const dir = join(homedir(), ".anis");
mkdirSync(dir, { recursive: true });
const stateFile = join(dir, "enrolment.json"), keyFile = join(dir, "anis-private-key.pem");
const need = (n) => process.env[n] || (() => { throw new Error(`Set ${n}`); })();

if (process.argv[2] === "status") {
  const st = JSON.parse(readFileSync(stateFile, "utf8"));
  const c = AnisEnrollmentClient.create({ authority: st.authority, invitationId: st.invitationId, enrollmentToken: need("ANIS_ENROLLMENT_TOKEN") });
  console.log(await c.getStatus());
  process.exit(0);
}

const authority = need("ANIS_AUTHORITY"), invitationId = need("ANIS_INVITATION_ID"), enrollmentToken = need("ANIS_ENROLLMENT_TOKEN");
if (existsSync(keyFile)) throw new Error(`${keyFile} already exists — move it away first (never overwrite a key that may already be enrolled).`);

const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
const pem = `-----BEGIN PRIVATE KEY-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
writeFileSync(keyFile, pem, { flag: "wx", mode: 0o600 }); // saved BEFORE anything is sent
const signer = await PemP256Signer.fromPem(pem);

const client = AnisEnrollmentClient.create({ authority, invitationId, enrollmentToken });
console.log("invitation:", await client.get());
const now = new Date();
const submitted = await client.submitKey({ publicJwk: await signer.publicJwk(), notBefore: now, expiresAt: new Date(now.getTime() + 730 * 864e5) });
writeFileSync(stateFile, JSON.stringify({ authority, invitationId, keyId: submitted.keyId, safetyCode: submitted.safetyCode, at: now.toISOString() }, null, 2), { mode: 0o600 });
const status = await client.prove(submitted, signer);
console.log("\nproof:", status.proofState, "· state:", status.state);
console.log("\n==============================");
console.log(" KEY ID      :", submitted.keyId);
console.log(" SAFETY CODE :", submitted.safetyCode, "  ← read this to Anis on the phone");
console.log("==============================");
console.log("Private key:", keyFile, "\nVercel env ANIS_PRIVATE_KEY = base64 of that file; ANIS_KEY_ID =", submitted.keyId, "; ANIS_AUTHORITY =", authority);
