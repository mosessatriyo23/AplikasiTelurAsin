import { validateEnvironment } from "../lib/environment";

const errors = validateEnvironment(process.env);
if (errors.length) {
  console.error("Konfigurasi environment tidak valid (nilai rahasia tidak ditampilkan):");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else console.log("Konfigurasi environment valid; nilai rahasia tidak ditampilkan.");
