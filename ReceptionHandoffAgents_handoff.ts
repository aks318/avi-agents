import "dotenv/config";
import fs from "node:fs/promises";
import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const MODEL = anthropic("claude-haiku-4-5-20251001");

const fetchAvailablePlans = tool({
  description: "Fetches the available plans for internet",
  inputSchema: z.object({}),
  execute: () => [
    { plan_id: "1", price_inr: 399, speed: "30MB/s" },
    { plan_id: "2", price_inr: 999, speed: "100MB/s" },
    { plan_id: "3", price_inr: 1499, speed: "200MB/s" },
  ],
});

const processRefund = tool({
  description: "Processes the refund for a customer",
  inputSchema: z.object({
    customerId: z.string().describe("id of the customer"),
    reason: z.string().describe("reason for refund"),
  }),
  execute: async ({ customerId, reason }) => {
    await fs.appendFile(
      "./refunds.txt",
      `Refund for Customer having ID ${customerId} for ${reason}\n`,
      "utf-8",
    );
    return { refundIssued: true };
  },
});

const agents = {
  sales: {
    name: "Sales Agent",
    system:
      "You are an expert sales agent for an internet broadband company. " +
      "You handle questions about plans and pricing, mostly for new customers. " +
      "Talk to the user and help them with what they need.",
    tools: { fetch_available_plans: fetchAvailablePlans },
  },
  refund: {
    name: "Refund Agent",
    system:
      "You are an expert in helping existing customers and issuing refunds. " +
      "When you have a customer id and a reason, call process_refund, " +
      "then confirm briefly what you did. If the customer id is missing, ask for it.",
    tools: { process_refund: processRefund },
  },
};

const handoffTools = {
  transfer_to_sales_agent: tool({
    description:
      "Hand off to the sales agent: plans, pricing, new connections, new customers.",
    inputSchema: z.object({
      reason: z.string().describe("why you are handing off"),
    }),
  }),
  transfer_to_refund_agent: tool({
    description:
      "Hand off to the refund agent: refund requests and billing problems from existing customers.",
    inputSchema: z.object({
      reason: z.string().describe("why you are handing off"),
    }),
  }),
};

const RECEPTION_SYSTEM =
  "You are the customer-facing reception agent. Understand what the customer needs, " +
  "then hand off to the right agent. Use transfer_to_sales_agent for plans and pricing, " +
  "and transfer_to_refund_agent for refunds from existing customers. " +
  "Do not answer those questions yourself. Only reply directly for simple greetings.";

const history: ModelMessage[] = [];
let activeAgents: keyof typeof agents | null = null;

async function runSpecialist(key: keyof typeof agents) {
  const agent = agents[key];

  const { text, steps, response } = await generateText({
    model: MODEL,
    system: agent.system,
    messages: history,
    tools: agent.tools,
    stopWhen: stepCountIs(4),
    maxOutputTokens: 400,
  });

  history.push(...response.messages);
  console.log(`[${agent.name}] steps: ${steps.length}`);
  return text;
}

async function handle(userText: string) {
  history.push({ role: "user", content: userText });

  if (activeAgents) {
    return runSpecialist(activeAgents);
  }

  const reception = await generateText({
    model: MODEL,
    system: RECEPTION_SYSTEM,
    messages: history,
    tools: handoffTools,
    stopWhen: stepCountIs(1),
    maxOutputTokens: 200,
  });

  const call = reception.toolCalls[0];
  if (!call) {
    history.push(...reception.response.messages);
    console.log("[Reception Agent] answered directly");
    return reception.text;
  }

  activeAgents =
    call.toolName === "transfer_to_sales_agent" ? "sales" : "refund";
  console.log(`[Reception Agent] handoff -> ${agents[activeAgents].name}`);

  // The tool call has no result, so we do NOT add reception's tool-call messages
  // to history (an unanswered tool call would break the next request).
  return runSpecialist(activeAgents);
}

async function main() {
  const reply = await handle("Hi There, I am Akash, I need all the plans");
  console.log("Result:", reply);
  console.log("History length:", history.length);

  // Follow-up goes straight to the active specialist (uncomment to test, costs credits):
  // console.log(await handle("Thanks. How long will the refund take?"));
}

main();
