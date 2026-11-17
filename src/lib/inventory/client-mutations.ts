"use client";

export type ClientMutationResult = {
  error: string | null;
  ok: boolean;
};

async function postForm(
  endpoint: string,
  formData: FormData,
): Promise<ClientMutationResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });

    let payload: ClientMutationResult;
    try {
      payload = (await response.json()) as ClientMutationResult;
    } catch {
      return {
        error: `Save failed (${response.status}). The server did not return JSON — the inventory write may not have reached Supabase.`,
        ok: false,
      };
    }

    if (!response.ok || !payload.ok) {
      return {
        error: payload.error || `Save failed (${response.status}).`,
        ok: false,
      };
    }

    return { error: null, ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Network error while saving.",
      ok: false,
    };
  }
}

export function addInventoryItemClient(
  formData: FormData,
): Promise<ClientMutationResult> {
  return postForm("/api/inventory/add", formData);
}

export function updateInventoryItemClient(
  formData: FormData,
): Promise<ClientMutationResult> {
  return postForm("/api/inventory/update", formData);
}

export function consumeInventoryItemClient(
  formData: FormData,
): Promise<ClientMutationResult> {
  return postForm("/api/inventory/consume", formData);
}

export function deleteInventoryItemClient(
  formData: FormData,
): Promise<ClientMutationResult> {
  return postForm("/api/inventory/delete", formData);
}
