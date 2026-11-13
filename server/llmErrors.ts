import { TRPCError } from "@trpc/server";
import { LlmProviderQuotaError, LlmProviderRequestError } from "./_core/llm";
import { GeminiProviderError } from "./gemini";
import { OpenRouterProviderError } from "./openRouter";

export function getLlmUserMessage(error: unknown) {
  if (error instanceof GeminiProviderError) {
    if (error.status === 429) {
      return "La génération est momentanément limitée par Gemini. Aucun crédit Lakay n’a été utilisé pour cette tentative. Attendez environ une minute, puis réessayez votre consigne sans la dupliquer.";
    }
    return "Lakay n’a pas pu obtenir une réponse du service IA. Votre projet et vos crédits sont conservés ; réessayez dans un instant.";
  }
  if (error instanceof LlmProviderQuotaError) {
    return "Le service IA est momentanément indisponible. Votre projet et vos crédits Lakay sont conservés ; réessayez dans un instant.";
  }
  if (error instanceof LlmProviderRequestError) {
    return "Le service IA n’a pas répondu correctement. Votre projet et vos crédits sont conservés ; réessayez dans un instant.";
  }
  if (error instanceof OpenRouterProviderError) {
    return "Lakay n’a pas pu joindre une réponse IA pour le moment. Votre projet et vos crédits Lakay sont conservés ; réessayez dans un instant.";
  }
  return null;
}

export function rethrowLlmError(error: unknown): never {
  const message = getLlmUserMessage(error);
  if (message) throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  if (error instanceof TRPCError) throw error;
  if (error instanceof Error && (error.name === "AbortError" || /timeout|timed out|network|fetch failed|socket|econn|unavailable/i.test(error.message))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lakay n’a pas pu joindre le service IA pour le moment. Votre projet est conservé ; réessayez dans un instant." });
  }
  throw error;
}
