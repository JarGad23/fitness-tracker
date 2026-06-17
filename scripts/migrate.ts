import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";

async function migrate() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  console.log("Connecting to Turso...");

  const sqlPath = join(process.cwd(), "drizzle", "0000_goofy_golden_guardian.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Running ${statements.length} migration statements...`);

  for (const statement of statements) {
    console.log("Executing:", statement.substring(0, 50) + "...");
    try {
      await client.execute(statement);
      console.log("✓ Success");
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        console.log("⚠ Table already exists, skipping");
      } else {
        throw error;
      }
    }
  }

  console.log("Migration complete!");
  client.close();
}

migrate().catch(console.error);
