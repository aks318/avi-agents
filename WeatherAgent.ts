import "dotenv/config";
import { generateText, generateObject, tool, stepCountIs, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const Model = anthropic("claude-haiku-4-5-20251001");

const WeatherResultSchema = z.object({
  city: z.string().describe("name of the city"),
  degree_c: z.number().describe("the temp in degree celcius"),
  condition: z.string().optional().describe("Condition of the weather"),
});

const getWeatherTool = tool({
  description: "Returns the current weather information for the given city",
  inputSchema: z.object({
    city: z.string().describe("name of the city"),
  }),
  execute: async ({ city }) => {
    const url = `https://wttr.in/${encodeURIComponent(city.toLowerCase())}?format=%C+%t`;
    const response = await fetch(url);
    if (!response.ok) {
      return `Could not get the weather for ${city} (status ${response.status}).`;
    }
    const text = await response.text();
    return `The weather of ${city} is ${text.trim()}`;
  },
});

async function main(query = "") {
  const { output, steps } = await generateText({
    model: Model,
    system:
      "You are an expert weather agent that tells users the weather report.",
    prompt: query,
    tools: { get_weather: getWeatherTool },
    output: Output.object({ schema: WeatherResultSchema }),
    stopWhen: stepCountIs(4),
    maxOutputTokens: 300,
  });

  console.log(`Steps taken: ${steps.length}`);
  console.log("Results:", output.degree_c, output);
}

main("What is the weather of Delhi and mumbai?");
