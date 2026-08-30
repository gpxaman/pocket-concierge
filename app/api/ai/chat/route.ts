import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Content as GeminiContent, FunctionDeclaration } from "@google/genai";
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
- Keep prose tight: 2-4 sentences plus the tool call, no filler.
- Plain prose only — no markdown bullet/numbered lists or headings. The client renders **bold** but nothing else, so bullets show up as literal asterisks.`;

type AsUserAssistant = ChatMessage & { role: "user" | "assistant" };
const isUserOrAssistant = (m: ChatMessage): m is AsUserAssistant => m.role === "user" || m.role === "assistant";

function runToolByName(name: string, input: Record<string, unknown>) {
  if (name === "search_catalog") return executeSearch(input as Parameters<typeof executeSearch>[0]);
  if (name === "get_item") return executeGetItem((input as { item_id: string }).item_id);
  if (name === "present_recommendations") return { acknowledged: true };
  return { error: `Unknown tool ${name}` };
}

async function runAnthropic(messages: ChatMessage[], apiKey: string) {
  const client = new Anthropic({ apiKey });

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter(isUserOrAssistant)
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

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
    if (toolUseBlocks.length === 0) break;

    const presentCall = toolUseBlocks.find((b) => b.name === "present_recommendations");
    anthropicMessages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((call) => {
      let result = runToolByName(call.name, call.input as Record<string, unknown>);
      if (call.name === "present_recommendations") {
        const input = call.input as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
    });

    anthropicMessages.push({ role: "user", content: toolResults });
    if (presentCall) break;
  }

  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "claude" as const };
}

const GEMINI_TOOLS: FunctionDeclaration[] = AI_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

async function runGemini(messages: ChatMessage[], apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });

  const contents: GeminiContent[] = messages
    .filter(isUserOrAssistant)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  let recommendedIds: string[] = [];
  let finalText = "";

  for (let turn = 0; turn < 6; turn++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: GEMINI_TOOLS }],
      },
    });

    const text = response.text?.trim();
    if (text) finalText = text;

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) break;

    const presentCall = calls.find((c) => c.name === "present_recommendations");

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responseParts = calls.map((call) => {
      const args = (call.args ?? {}) as Record<string, unknown>;
      let result = runToolByName(call.name ?? "", args);
      if (call.name === "present_recommendations") {
        const input = args as { item_ids: string[]; reasoning: string };
        recommendedIds = input.item_ids;
        finalText = finalText || input.reasoning;
      }
      return { functionResponse: { id: call.id, name: call.name, response: { output: result } } };
    });

    contents.push({ role: "user", parts: responseParts });
    if (presentCall) break;
  }

  return { reply: finalText || "Here's what I found.", itemIds: recommendedIds, mode: "gemini" as const };
}

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  try {
    // Gemini first — that's the provider being tested right now.
    if (geminiKey) return NextResponse.json(await runGemini(messages, geminiKey));
    if (anthropicKey) return NextResponse.json(await runAnthropic(messages, anthropicKey));
  } catch (err) {
    console.error("[ai/chat] provider call failed, falling back:", err);
  }

  const fallback = runFallbackAgent(messages);
  return NextResponse.json({ reply: fallback.reply, itemIds: fallback.itemIds, mode: "fallback" as const });
}
