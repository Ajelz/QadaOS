import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

// A placeholder keeps module import side-effect free for CLIs; real requests need the env.
const url = process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder";

export const db = drizzle(neon(url), { schema, casing: "snake_case" });
export type Db = typeof db;
