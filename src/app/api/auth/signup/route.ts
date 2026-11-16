import { NextResponse } from "next/server";
import { performSignUp } from "@/lib/auth/perform-auth";

/**
 * Signup via Route Handler (not a Server Action).
 * Evidence: live Auth logs showed no signup while the UI crashed — Server
 * Action POSTs can fail before reaching business logic when a proxy/session
 * layer interferes. This path is a normal POST /api/auth/signup.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await performSignUp({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      householdName: String(formData.get("householdName") ?? ""),
    });

    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signup request failed.";
    return NextResponse.json(
      {
        error: message,
        message: null,
        redirectTo: null,
        reachedAuthApi: false,
      },
      { status: 500 },
    );
  }
}
