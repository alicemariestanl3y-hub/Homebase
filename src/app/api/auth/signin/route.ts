import { NextResponse } from "next/server";
import { performSignIn } from "@/lib/auth/perform-auth";

/** Sign-in via Route Handler — same rationale as /api/auth/signup. */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await performSignIn({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sign-in request failed.";
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
