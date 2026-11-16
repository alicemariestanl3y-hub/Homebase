export type AuthValidationResult =
  | { ok: true; email: string; password: string; householdName: string }
  | { ok: false; error: string };

export function validateSignUpInput(input: {
  email: string;
  password: string;
  householdName?: string;
}): AuthValidationResult {
  const email = input.email.trim();
  const password = input.password;
  const householdName = (input.householdName ?? "").trim() || "My Kitchen";

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (password.length < 6) {
    return {
      ok: false,
      error: "Use a password of at least 6 characters.",
    };
  }
  return { ok: true, email, password, householdName };
}

export function validateSignInInput(input: {
  email: string;
  password: string;
}): AuthValidationResult {
  const email = input.email.trim();
  const password = input.password;

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  return { ok: true, email, password, householdName: "My Kitchen" };
}
