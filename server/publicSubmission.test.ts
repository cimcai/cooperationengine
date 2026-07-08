import { describe, it, expect } from "vitest";
import { publicSubmissionSchema } from "../shared/schema";

describe("publicSubmissionSchema", () => {
  it("accepts a link only", () => {
    const r = publicSubmissionSchema.safeParse({ link: "https://example.com/paper" });
    expect(r.success).toBe(true);
  });

  it("accepts pasted content only", () => {
    const r = publicSubmissionSchema.safeParse({ content: "A cooperation dilemma dataset." });
    expect(r.success).toBe(true);
  });

  it("accepts optional name / email / affiliation / title", () => {
    const r = publicSubmissionSchema.safeParse({
      link: "https://example.com/x",
      title: "My contribution",
      name: "Ada",
      email: "ada@example.com",
      affiliation: "Example Lab",
    });
    expect(r.success).toBe(true);
  });

  it("rejects when neither link nor content is provided", () => {
    const r = publicSubmissionSchema.safeParse({ title: "empty" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid URL", () => {
    const r = publicSubmissionSchema.safeParse({ link: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email when one is given", () => {
    const r = publicSubmissionSchema.safeParse({ link: "https://example.com", email: "nope" });
    expect(r.success).toBe(false);
  });

  it("treats empty-string optionals as absent", () => {
    const r = publicSubmissionSchema.safeParse({ link: "https://example.com", email: "", title: "" });
    expect(r.success).toBe(true);
  });
});
