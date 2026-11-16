"use server";

import {
  validateSignInInput,
  validateSignUpInput,
} from "@/lib/auth/validation";
import { ensureHouseholdForCurrentUser } from "@/lib/inventory/ensure-household";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthActionState = {
  error: string | null;
  message: string | null;
  /** Full page navigation after cookies are set — avoids redirect()+cookie races. */
  redirectTo: string | null;
};

export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error: "Supabase is not configured yet.",
      message: null,
      redirectTo: null,
    };
  }

  const parsed = validateSignUpInput({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    householdName: String(formData.get("householdName") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.error, message: null, redirectTo: null };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        data: {
          household_name: parsed.householdName,
          display_name: parsed.email.split("@")[0],
        },
      },
    });

    if (error) {
      return { error: error.message, message: null, redirectTo: null };
    }

    // Email confirmation enabled → no session yet.
    if (!data.session) {
      return {
        error: null,
        message:
          "Account created. Check your email to confirm, then sign in. (For easier testing: Supabase → Authentication → Providers → Email → disable Confirm email.)",
        redirectTo: null,
      };
    }

    const household = await ensureHouseholdForCurrentUser(parsed.householdName);
    if (household.error && !household.householdId) {
      return {
        error: household.error,
        message: null,
        redirectTo: null,
      };
    }

    return { error: null, message: null, redirectTo: "/" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create account.";
    return { error: message, message: null, redirectTo: null };
  }
}

export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error: "Supabase is not configured yet.",
      message: null,
      redirectTo: null,
    };
  }

  const parsed = validateSignInInput({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.error, message: null, redirectTo: null };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      return { error: error.message, message: null, redirectTo: null };
    }

    const household = await ensureHouseholdForCurrentUser();
    if (household.error && !household.householdId) {
      return {
        error: household.error,
        message: null,
        redirectTo: null,
      };
    }

    return { error: null, message: null, redirectTo: "/" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign in.";
    return { error: message, message: null, redirectTo: null };
  }
}

export async function signOut(): Promise<void> {
  const { redirect } = await import("next/navigation");
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Still leave the app even if sign-out API fails.
  }
  redirect("/login");
}
