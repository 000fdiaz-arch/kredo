import { describe, expect, it } from "vitest";
import { toWhatsAppPhone } from "@/lib/phone";

describe("toWhatsAppPhone", () => {
  it("keeps a Panama number that already includes its country code", () => {
    expect(toWhatsAppPhone("+507 6123-4567")).toBe("50761234567");
  });

  it("adds Panama's country code to an eight digit local number", () => {
    expect(toWhatsAppPhone("6123-4567")).toBe("50761234567");
  });

  it("removes an international dialing prefix", () => {
    expect(toWhatsAppPhone("00507 6123 4567")).toBe("50761234567");
  });
});
