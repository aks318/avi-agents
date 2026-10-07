import "dotenv/config";
import fs from "node:fs/promises";
import { generateText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const MODEL = anthropic("claude-haiku-4-5-20251001");

const fetchAvailablePlans = tool({
  description: "Fetches the available plans for internet",
  inputSchema: z.object({}),
  execute: async () => [
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

async function refundAgent(request: string) {
  const { text, steps } = await generateText({
    model: MODEL,
    system:
      "You are an expert in issuing refunds to the customer. " +
      "Use the process_refund tool when you have a customer id and a reason, " +
      "then confirm briefly what you did.",
    prompt: request,
    tools: { process_refund: processRefund },
    stopWhen: stepCountIs(3),
    maxOutputTokens: 300,
  });

  console.log(`  [refund agent] steps: ${steps.length}`);
  return text;
}

const refundExpert = tool({
  description: "Handles refund questions and requests.",
  inputSchema: z.object({
    request: z
      .string()
      .describe(
        "The customer's refund request, including their customer id and the reason",
      ),
  }),
  execute: async ({ request }) => refundAgent(request),
});

async function runSalesAgent(query = "") {
  const { text, steps } = await generateText({
    model: MODEL,
    system:
      "You are an expert sales agent for an internet broadband company. " +
      "Talk to the user and help them with what they need. " +
      "For refund requests, delegate to the refund_expert tool and include " +
      "the customer id and the reason in your request.",
    prompt: query,
    tools: {
      fetch_Available_Plans: fetchAvailablePlans,
      refund_expert: refundExpert,
    },
    stopWhen: stepCountIs(6),
    maxOutputTokens: 500,
  });
  console.log(`[sales agent] steps: ${steps.length}`);
  console.log(text);
}

runSalesAgent(
  "I had a plan 399. I need a refund right now. my cus id is cust123 because of I am shifting to a new place",
);
