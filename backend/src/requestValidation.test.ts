import { requireBoundedInteger } from "./requestValidation";

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
