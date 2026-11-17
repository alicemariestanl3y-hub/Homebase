import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAuthRoutePath,
  isBenignSessionError,
  isPublicApiPath,
} from "./proxy-helpers";

describe("isBenignSessionError", () => {
  it("treats missing session as signed out", () => {
    assert.equal(
      isBenignSessionError({
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      }),
      true,
    );
  });

  it("treats refresh-token errors as signed out", () => {
    assert.equal(
      isBenignSessionError({
        message: "Invalid Refresh Token: Refresh Token Not Found",
        status: 401,
      }),
      true,
    );
  });

  it("treats HTTP 401 as signed out so the login form can show", () => {
    assert.equal(
      isBenignSessionError({
        message: "Invalid API key",
        status: 401,
      }),
      true,
    );
  });

  it("flags non-401 API key failures as config errors", () => {
    assert.equal(
      isBenignSessionError({
        message: "Invalid API key",
      }),
      false,
    );
  });
});


describe("route classifiers", () => {
  it("recognizes auth and public API paths", () => {
    assert.equal(isAuthRoutePath("/login"), true);
    assert.equal(isAuthRoutePath("/signup"), true);
    assert.equal(isAuthRoutePath("/"), false);
    assert.equal(isPublicApiPath("/api/status"), true);
    assert.equal(isPublicApiPath("/api/capture/analyze"), true);
    assert.equal(isPublicApiPath("/api/capture/save"), true);
    assert.equal(isPublicApiPath("/api/auth/signup"), true);
    assert.equal(isPublicApiPath("/api/inventory/add"), true);
    assert.equal(isPublicApiPath("/capture"), false);
  });
});
