"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthActionState = {
  error: string | null;
  message: string | null;
};

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured yet.", message: null };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const householdName =
    String(formData.get("householdName") ?? "").trim() || "My Kitchen";

  if (!email || password.length < 6) {
    return {
      error: "Use a valid email and a password of at least 6 characters.",
      message: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        household_name: householdName,
        display_name: email.split("@")[0],
      },
    },
  });

  if (error) {
    return { error: error.message, message: null };
  }

  // If email confirmation is enabled in Supabase, there is no session yet.
  if (!data.session) {
    return {
      error: null,
      message:
        "Account created. Check your email to confirm, then sign in. (For easier testing, you can disable Confirm email in Supabase Auth settings.)",
    };
  }

  redirect("/");
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured yet.", message: null };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required.", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, message: null };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
