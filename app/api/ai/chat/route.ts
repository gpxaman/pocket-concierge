import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS, executeGetItem, executeSearch } from "@/lib/ai/tools";
import { runFallbackAgent } from "@/lib/ai/fallback";
import { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are the AI personal concierge for a super-app. The user describes an outcome
they want (buying a laptop, booking a hotel, ordering food, getting a ride, home services) —
you figure out the relevant technical/practical criteria, not the other way around.

Rules:
- Ask only necessary clarifying questions (budget, timing, key constraints) — don't interrogate.
- Ground every recommendation in search_catalog/get_item results. Never invent items, prices or providers.
- Explain recommendations in plain language with real trade-offs, not just a list.
- When you're ready to recommend, call present_recommendations exactly once with 1-4 item ids.
- If you still need info, just ask in plain text (no tool call) — keep it to one short question.
- Keep prose tight: 2-4 sentences plus the tool call, no filler.`;

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const fallback = runFallbackAgent(messages);
    return NextResponse.json({
      reply: fallback.reply,
      itemIds: fallback.itemIds,
      mode: "fallback" as const,
    });
  }

  const client = new Anthropic({ apiKey });

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  let recommendedIds: string[] = [];
  let finalText = "";

  // Bounded tool loop: search/get_item are read-only and safe to auto-run;
  // present_recommendations is terminal. Cap iterations so a misbehaving
  // model can't loop forever against our own API.
  for (let turn = 0; turn < 6; turn++) {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: AI_TOOLS as unknown as Anthropic.Tool[],
      messages: anthropicMessages,
    });

    const textBlocks = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
    finalText = textBlocks.map((b) => b.text).join("\n").trim();

    const toolUseBlocks = response.content.filter(
      (b) => b.type === "tool_use"
    ) as Anthropic.ToolUseBlock[];

    if (toolUseBlocks.length === 0) {
      // Plain-text turn: either a clarifying question or a final answer with no tools needed.
      break;
    }

    const presentCall = toolUseBlocks.find((b) => b.name === "present_recommendations");

    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((call) => {
      let result: unknown;
      if (call.name === "search_catalog") {
        result = executeSearch(call.input as Parameters<typeof executeSearch>[0]);
      } else if (call.name === "get_item") {
        result = executeGetItem((call.input as { item_id: string }).item_id);
      } else if (call.name === "present_recommendations") {
        const input = call.input as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
        result = { acknowledged: true };
      } else {
        result = { error: `Unknown tool ${call.name}` };
      }
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
    });

    anthropicMessages.push({ role: "user", content: toolResults });

    if (presentCall) break;
  }

  return NextResponse.json({
    reply: finalText || "Here's what I found.",
    itemIds: recommendedIds,
    mode: "claude" as const,
  });
}
