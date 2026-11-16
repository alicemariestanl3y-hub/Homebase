import {
  validateSignInInput,
  validateSignUpInput,
} from "@/lib/auth/validation";
import { ensureHouseholdForCurrentUser } from "@/lib/inventory/ensure-household";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthResult = {
  error: string | null;
  message: string | null;
  redirectTo: string | null;
  /** Set when Auth API was contacted (even if it returned an error). */
  reachedAuthApi: boolean;
};

export async function performSignUp(input: {
  email: string;
  password: string;
  householdName: string;
}): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      error: "Supabase is not configured yet.",
      message: null,
      redirectTo: null,
      reachedAuthApi: false,
    };
  }

  const parsed = validateSignUpInput(input);
  if (!parsed.ok) {
    return {
      error: parsed.error,
      message: null,
      redirectTo: null,
      reachedAuthApi: false,
    };
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
      return {
        error: error.message,
        message: null,
        redirectTo: null,
        reachedAuthApi: true,
      };
    }

    if (!data.session) {
      return {
        error: null,
        message:
          "Account created. Check your email to confirm, then sign in. (For easier testing: Supabase → Authentication → Providers → Email → disable Confirm email.)",
        redirectTo: null,
        reachedAuthApi: true,
      };
    }

    const household = await ensureHouseholdForCurrentUser(
      parsed.householdName,
      supabase,
    );
    if (household.error && !household.householdId) {
      return {
        error: `Account created, but household setup failed: ${household.error}`,
        message: null,
        redirectTo: null,
        reachedAuthApi: true,
      };
    }

    return {
      error: null,
      message: null,
      redirectTo: "/",
      reachedAuthApi: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create account.";
    return {
      error: message,
      message: null,
      redirectTo: null,
      reachedAuthApi: false,
    };
  }
}

export async function performSignIn(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      error: "Supabase is not configured yet.",
      message: null,
      redirectTo: null,
      reachedAuthApi: false,
    };
  }

  const parsed = validateSignInInput(input);
  if (!parsed.ok) {
    return {
      error: parsed.error,
      message: null,
      redirectTo: null,
      reachedAuthApi: false,
    };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      return {
        error: error.message,
        message: null,
        redirectTo: null,
        reachedAuthApi: true,
      };
    }

    const household = await ensureHouseholdForCurrentUser(
      "My Kitchen",
      supabase,
    );
    if (household.error && !household.householdId) {
      return {
        error: `Signed in, but household setup failed: ${household.error}`,
        message: null,
        redirectTo: null,
        reachedAuthApi: true,
      };
    }

    return {
      error: null,
      message: null,
      redirectTo: "/",
      reachedAuthApi: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign in.";
    return {
      error: message,
      message: null,
      redirectTo: null,
      reachedAuthApi: false,
    };
  }
}
