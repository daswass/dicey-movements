import { requireBoolean, requireBoundedInteger, requireBoundedString, requireUuid } from "./requestValidation";

describe("requireBoundedInteger", () => {
  it("accepts values inside bounds", () => {
    expect(requireBoundedInteger(7, "days", 1, 31)).toBe(7);
  });

  it.each([0, 32, 1.5, "7", null])("rejects invalid bounded values: %p", (value) => {
    expect(() => requireBoundedInteger(value, "days", 1, 31)).toThrow(
      "days must be an integer between 1 and 31"
    );
  });
});

describe("request primitives", () => {
  it("accepts a UUID, bounded text, and boolean", () => {
    expect(requireUuid("00000000-0000-4000-8000-000000000000", "userId")).toBeDefined();
    expect(requireBoundedString(" high five ", "activity", 20)).toBe("high five");
    expect(requireBoolean(true, "enabled")).toBe(true);
  });

  it("rejects malformed UUIDs, oversized activity, and non-boolean settings", () => {
    expect(() => requireUuid("not-a-uuid", "userId")).toThrow("userId must be a UUID");
    expect(() => requireBoundedString("x".repeat(201), "activity", 200)).toThrow("activity must be a non-empty string up to 200 characters");
    expect(() => requireBoolean("true", "enabled")).toThrow("enabled must be a boolean");
  });
});
