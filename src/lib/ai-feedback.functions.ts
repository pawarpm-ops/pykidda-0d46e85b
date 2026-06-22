import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";


const Input = z.object({
  title: z.string(),
  prompt: z.string(),
  userCode: z.string().max(20000),
  referenceSolution: z.string().max(20000),
  failingTests: z
    .array(
      z.object({
        stdin: z.string().optional().default(""),
        expected: z.string(),
        actual: z.string(),
        stderr: z.string().optional().default(""),
      }),
    )
    .max(10),
});

const Output = z.object({
  explanation: z.string(),
  fixedCode: z.string(),
});

export const explainAndFix = createServerFn({ method: "POST" })
export const explainAndFix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const sys = `You are a friendly Python tutor for Indian college students preparing for Python exams.
The student wrote Python code for a problem and it failed some tests. You must:
1. Briefly explain WHAT is wrong with the student's code (2-5 short sentences, plain language, point to specific lines or logic). Do NOT just paste the answer.
2. Provide a corrected version of THEIR code — keep their style/variable names where possible, fix only what's broken. The corrected code must pass all tests.

Return ONLY a single JSON object: {"explanation": "...", "fixedCode": "..."}. No markdown fences, no extra prose.`;

    const failingText = data.failingTests
      .map(
        (t, i) =>
          `Test ${i + 1}:\nstdin: ${JSON.stringify(t.stdin)}\nexpected: ${JSON.stringify(t.expected)}\ntheir output: ${JSON.stringify(t.actual)}\nstderr: ${JSON.stringify(t.stderr)}`,
      )
      .join("\n\n");

    const user = `Problem: ${data.title}\n${data.prompt}\n\nReference solution (for your eyes, don't just copy it verbatim — adapt to the student's code):\n\`\`\`python\n${data.referenceSolution}\n\`\`\`\n\nStudent's code:\n\`\`\`python\n${data.userCode}\n\`\`\`\n\nFailing tests:\n${failingText}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in Settings → Plans & credits.");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: { explanation: string; fixedCode: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to strip code fences
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI returned unparseable response.");
      parsed = JSON.parse(m[0]);
    }
    return Output.parse(parsed);
  });
