type ClassificationInput = {
  subject: string;
  from: string;
  snippet: string;
  body: string;
};

type ClassificationResult = {
  company: string;
  role: string;
  status: "applied" | "accepted" | "rejected";
  isJob: boolean;
};

const statusSet = new Set(["applied", "accepted", "rejected"]);

export const classifyApplicationEmail = async (
  input: ClassificationInput
): Promise<ClassificationResult | null> => {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

  const prompt =
    "You classify whether an email is a job application-related message. " +
    "Respond with strict JSON: " +
    '{"isJob":true|false,"company":"...", "role":"...", "status":"applied|accepted|rejected"}.' +
    "Only set isJob true for actual job application/interview/offer/rejection emails. " +
    "If isJob is false, keep company/role/status as empty strings.\n\n" +
    `Email:\n${JSON.stringify(input)}`;

  console.log("LLM classification: Ollama request start");

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    console.log("LLM classification: Ollama request failed", response.status);
    return null;
  }

  const data = (await response.json()) as { response?: string };
  const content = data.response;
  if (!content) {
    return null;
  }

  let parsed: Partial<ClassificationResult> | null = null;
  try {
    parsed = JSON.parse(content) as Partial<ClassificationResult>;
  } catch {
    return null;
  }

  if (!parsed) {
    return null;
  }

  if (parsed.isJob === false) {
    return {
      isJob: false,
      company: "",
      role: "",
      status: "applied",
    };
  }

  if (!parsed.status || !statusSet.has(parsed.status)) {
    return null;
  }

  return {
    isJob: parsed.isJob === undefined ? true : Boolean(parsed.isJob),
    company: parsed.company?.trim() || "",
    role: parsed.role?.trim() || "",
    status: parsed.status,
  };
};
