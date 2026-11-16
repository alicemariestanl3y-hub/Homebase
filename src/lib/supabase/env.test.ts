import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { diagnoseSupabaseEnv, getSupabaseEnv } from "./env";

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_URL",
  "SUPABASE_KEY",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("getSupabaseEnv", () => {
  it("returns null when unset", () => {
    assert.equal(getSupabaseEnv(), null);
    assert.equal(diagnoseSupabaseEnv().reason, "missing_url");
  });

  it("accepts a normal project URL + anon key", () => {
    process.env.SUPABASE_URL = "https://abc.supabase.co/";
    process.env.SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature";
    const env = getSupabaseEnv();
    assert.ok(env);
    assert.equal(env?.url, "https://abc.supabase.co");
  });

  it("strips NAME=value paste mistakes", () => {
    process.env.SUPABASE_URL = 'SUPABASE_URL="https://abc.supabase.co"';
    process.env.SUPABASE_ANON_KEY =
      "SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature";
    const env = getSupabaseEnv();
    assert.ok(env);
    assert.equal(env?.url, "https://abc.supabase.co");
    assert.ok(env?.anonKey.startsWith("eyJ"));
  });

  it("rejects invalid URLs", () => {
    process.env.SUPABASE_URL = "not-a-url";
    process.env.SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature";
    assert.equal(getSupabaseEnv(), null);
    assert.equal(diagnoseSupabaseEnv().reason, "invalid_url");
  });
});
