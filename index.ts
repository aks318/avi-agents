import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

let location = "india";

function getInstructions() {
  if (location === "india") {
    return "Always say namaste, then say hello world with the user's name.";
  }
  return "Just talk to the user.";
}

const result = await generateText({
  model: anthropic("claude-haiku-4-5-20251001"),
  system: getInstructions(),
  prompt: "Hey there , my name is Aakash",
});

console.log(result.text);
