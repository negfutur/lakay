import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  Check,
  ChevronRight,
  Copy,
  Eye,
  ImagePlus,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type ChatWorkStage = { label: string; state: "pending" | "active" | "complete" };
export type ChatError = { title: string; detail: string; onRetry?: () => void; hidePersistedTerminalFailureMessage?: boolean };
export type ChatBackgroundTask = { progress: string; status: "queued" | "in_progress" | "requires_action"; onCancel?: () => void };

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string, imageKey?: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onOpenPreview?: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
  showLoadingIndicator?: boolean;
  workStages?: ChatWorkStage[];
  error?: ChatError | null;
  backgroundTask?: ChatBackgroundTask | null;
};

export function AIChatBox({
  messages,
  onSendMessage,
  onUploadImage,
  onOpenPreview,
  isLoading = false,
  loadingMessage = "Lakay construit les fichiers et prépare l’aperçu…",
  placeholder = "Écrivez votre message…",
  className,
  height = "600px",
  emptyStateMessage = "Commencez à créer avec Lakay.",
  suggestedPrompts,
  showLoadingIndicator = true,
  workStages,
  error,
  backgroundTask,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const forceNextScrollRef = useRef(true);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [isAwayFromLatest, setIsAwayFromLatest] = useState(false);
  const displayMessages = messages.filter(message => {
    if (message.role === "system") return false;
    if (message.role === "assistant" && /^\s*Contexte interne Lakay\s*:/i.test(message.content)) return false;
    if (message.role === "assistant" && /Demander confirmation avant toute action irréversible, paiement, publication ou suppression importante\./i.test(message.content)) return false;
    if (!error?.hidePersistedTerminalFailureMessage || message.role !== "assistant") return true;
    return !/la tâche en arrière-plan n’a pas pu être finalisée|la génération n’a pas abouti|je n[’']ai pas pu terminer l[’']analyse de cette demande|la version actuelle est conservée/i.test(message.content);
  });

  const scrollToBottom = (options?: { force?: boolean; smooth?: boolean }) => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLDivElement | null;
    if (!viewport || (!options?.force && !isNearBottomRef.current)) return false;
    requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: options?.smooth ? "smooth" : "auto" });
      isNearBottomRef.current = true;
      setHasUnreadMessages(false);
      setIsAwayFromLatest(false);
    });
    return true;
  };

  useEffect(() => {
    if (!displayMessages.length) return;
    const shouldFollow = forceNextScrollRef.current || isNearBottomRef.current;
    forceNextScrollRef.current = false;
    if (!scrollToBottom({ force: shouldFollow })) setHasUnreadMessages(true);
  }, [displayMessages.length, isLoading]);

  useEffect(() => {
    if (!displayMessages.length) return;
    let detachScrollListener: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
      if (!viewport) return;
      const updateReaderPosition = () => {
        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        isNearBottomRef.current = distanceFromBottom < 88;
        setIsAwayFromLatest(!isNearBottomRef.current);
        if (isNearBottomRef.current) setHasUnreadMessages(false);
      };
      updateReaderPosition();
      viewport.addEventListener("scroll", updateReaderPosition, { passive: true });
      detachScrollListener = () => viewport.removeEventListener("scroll", updateReaderPosition);
    });
    return () => { window.cancelAnimationFrame(frame); detachScrollListener?.(); };
  }, [displayMessages.length > 0]);

  useEffect(() => {
    if (!isLoading) submittingRef.current = false;
  }, [isLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if ((!content && !attachment) || isLoading || submittingRef.current) return;

    submittingRef.current = true;
    try {
      const imageKey = attachment && onUploadImage ? await onUploadImage(attachment) : undefined;
      forceNextScrollRef.current = true;
      onSendMessage(content, imageKey);
      setInput("");
      setAttachment(null);
      setAttachmentError(null);
      scrollToBottom({ force: true, smooth: true });
      textareaRef.current?.focus();
    } catch (error) {
      submittingRef.current = false;
      setAttachmentError(error instanceof Error ? error.message : "L’image n’a pas pu être ajoutée.");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit(event);
    }
  };

  const sendSuggestedPrompt = (prompt: string) => {
    if (isLoading || submittingRef.current) return;
    submittingRef.current = true;
    forceNextScrollRef.current = true;
    onSendMessage(prompt);
    scrollToBottom({ force: true, smooth: true });
    textareaRef.current?.focus();
  };

  const copyAnswer = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content.replace("[[lakay:open-preview]]", "").trim());
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1800);
    } catch {
      setAttachmentError("Impossible de copier la réponse automatiquement.");
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden bg-[radial-gradient(100%_48%_at_50%_0%,rgba(139,92,246,0.08),transparent_55%)] text-zinc-100",
        className,
      )}
      style={{ height }}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/25 to-transparent" />
      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
            <div className="absolute size-40 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative grid size-14 place-items-center rounded-[1.25rem] border border-violet-200/20 bg-gradient-to-br from-violet-300/25 via-violet-400/10 to-fuchsia-400/15 shadow-[0_18px_55px_rgba(124,58,237,0.22)]">
              <Wand2 className="size-6 text-violet-100" />
              <span className="absolute -inset-1 -z-10 rounded-[1.5rem] border border-violet-300/10 animate-pulse" />
            </div>
            <p className="relative mt-5 text-sm font-semibold tracking-[0.01em] text-zinc-100">Votre studio est prêt</p>
            <p className="relative mt-1.5 max-w-sm text-sm leading-6 text-zinc-500">{emptyStateMessage}</p>
            {suggestedPrompts?.length ? (
              <div className="relative mt-7 grid w-full max-w-md gap-2 text-left">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendSuggestedPrompt(prompt)}
                    disabled={isLoading}
                    className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-gradient-to-r from-white/[0.05] to-white/[0.02] px-3.5 py-3 text-left text-xs text-zinc-400 shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300/30 hover:from-violet-400/[0.12] hover:to-fuchsia-400/[0.05] hover:text-zinc-100 disabled:opacity-50"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg border border-violet-300/15 bg-violet-400/10 text-[10px] font-bold text-violet-100">
                      {index + 1}
                    </span>
                    <span className="flex-1">{prompt}</span>
                    <ChevronRight className="size-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-200" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ScrollArea className="h-full [&_[data-radix-scroll-area-viewport]]:overscroll-contain">
            <div className="mx-auto w-full max-w-2xl space-y-7 px-4 py-6 sm:px-6 sm:py-7">
              {displayMessages.map((message, index) => {
                const hasPreviewAction = message.role === "assistant" && message.content.includes("[[lakay:open-preview]]");
                const content = message.content.replace("[[lakay:open-preview]]", "").trim();
                const assistant = message.role === "assistant";

                return (
                  <div key={`${message.role}-${index}`} className={cn("flex w-full gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "text-sm leading-6",
                        message.role === "user"
                          ? "max-w-[88%] rounded-2xl rounded-br-md border border-violet-200/15 bg-gradient-to-br from-violet-400/[0.18] via-violet-500/[0.12] to-fuchsia-400/[0.09] px-3.5 py-2.5 text-left text-violet-50 shadow-[0_12px_28px_rgba(76,29,149,0.14)] sm:max-w-[76%]"
                          : "min-w-0 max-w-[94%] border-t border-white/[0.055] pt-3 text-zinc-300 sm:max-w-[90%]",
                      )}
                    >
                      {assistant ? (
                        <>
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="size-3.5 text-violet-200" />
                            <span className="text-xs font-semibold tracking-[0.03em] text-zinc-100">Lakay</span>
                            <button
                              type="button"
                              onClick={() => copyAnswer(content, index)}
                              className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.055] hover:text-zinc-100"
                              aria-label="Copier la réponse"
                              title="Copier la réponse"
                            >
                              {copiedIndex === index ? <Check className="size-3.5 text-emerald-200" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-6 prose-strong:text-zinc-100 prose-li:my-0.5 prose-code:rounded prose-code:bg-violet-300/10 prose-code:px-1 prose-code:py-0.5 prose-code:text-violet-100 prose-code:before:content-none prose-code:after:content-none prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-violet-200/15 prose-pre:bg-[#0a0a10] prose-pre:px-3 prose-pre:py-3 prose-pre:shadow-inner prose-pre:before:content-none prose-pre:after:content-none">
                            <Streamdown>{content}</Streamdown>
                          </div>
                          {hasPreviewAction && onOpenPreview ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                            {hasPreviewAction && onOpenPreview ? (
                              <button
                                type="button"
                                onClick={onOpenPreview}
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-200 via-violet-300 to-fuchsia-300 px-3.5 text-xs font-bold text-zinc-950 shadow-[0_13px_26px_rgba(167,139,250,0.20)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(167,139,250,0.28)] active:translate-y-0"
                              >
                                <Eye className="size-3.5" />
                                Voir l’aperçu
                              </button>
                            ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{content}</p>
                      )}
                    </div>
                    {message.role === "user" ? <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full border border-violet-200/20 bg-violet-300/[0.12] text-violet-100 shadow-[0_6px_16px_rgba(76,29,149,0.16)]" aria-label="Votre message"><UserRound className="size-3.5" /></span> : null}
                  </div>
                );
              })}

              {isLoading && showLoadingIndicator && !backgroundTask ? (
                <div aria-live="polite" className="px-1 py-2">
                  <div className="flex items-center gap-2.5 text-xs font-medium text-violet-100">
                    <span aria-hidden="true" className="relative grid size-6 shrink-0 place-items-center">
                      <i className="absolute inset-0 rounded-full bg-violet-300/20 motion-safe:animate-ping motion-reduce:hidden" />
                      <span className="relative grid size-5 place-items-center rounded-full border border-violet-200/20 bg-violet-300/[0.12] shadow-[0_0_18px_rgba(167,139,250,0.18)]">
                        <Loader2 className="size-3 text-violet-100 motion-safe:animate-spin" />
                      </span>
                    </span>
                    <span>Lakay travaille</span>
                    <span className="flex shrink-0 gap-0.5" aria-label="Chargement">
                      <i className="size-1 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.2s]" />
                      <i className="size-1 animate-bounce rounded-full bg-fuchsia-200 [animation-delay:-0.1s]" />
                      <i className="size-1 animate-bounce rounded-full bg-violet-200" />
                    </span>
                    <span className="min-w-0 truncate text-violet-100/55">{loadingMessage}</span>
                  </div>
                  {workStages?.length ? <details className="mt-1.5 pl-5"><summary className="cursor-pointer text-[10px] font-medium text-violet-100/60 transition-colors hover:text-violet-100">Voir les détails</summary><div className="mt-2 flex flex-wrap gap-1.5">{workStages.map(stage => <span key={stage.label} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors", stage.state === "complete" ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100" : stage.state === "active" ? "border-violet-200/30 bg-violet-200/[0.12] text-violet-50" : "border-white/[0.07] bg-white/[0.025] text-violet-100/40") }><i className={cn("size-1.5 rounded-full", stage.state === "complete" ? "bg-emerald-300" : stage.state === "active" ? "animate-pulse bg-violet-200" : "bg-zinc-600")} />{stage.label}</span>)}</div></details> : null}
                </div>
              ) : null}

              {backgroundTask ? (
                <div aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-violet-200/10 px-1 py-2 text-xs">
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-violet-200" />
                  <span className="shrink-0 font-semibold text-violet-50">Lakay travaille</span>
                  <span className="min-w-0 flex-1 truncate text-violet-100/65">{backgroundTask.progress}</span>
                  {backgroundTask.onCancel ? <button type="button" onClick={backgroundTask.onCancel} className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-violet-100/70 transition-colors hover:bg-white/[0.07] hover:text-violet-50"><X className="size-3" />Annuler</button> : null}
                </div>
              ) : null}

              {error ? (
                <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-rose-300/15 px-1 py-3 text-xs">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-rose-300/[0.08] text-rose-100"><AlertTriangle className="size-3.5" /></span>
                  <p className="font-medium text-zinc-200">{error.title}</p>
                  {error.title.includes("services IA") ? <span className="text-[11px] text-emerald-100/70">Aucun crédit n’a été prélevé.</span> : null}
                  <details className="text-[11px] text-zinc-500"><summary className="cursor-pointer list-none text-zinc-500 transition-colors hover:text-zinc-300">Voir le détail</summary><p className="mt-1 max-w-xl leading-5 text-zinc-500">{error.detail}</p></details>
                  {error.onRetry ? <button type="button" onClick={error.onRetry} disabled={isLoading} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-white/[0.11] hover:text-white disabled:cursor-wait disabled:opacity-55"><RotateCcw className={cn("size-3", isLoading && "animate-spin")} />{isLoading ? "Relance…" : "Réessayer"}</button> : null}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </div>

      {displayMessages.length > 0 && (hasUnreadMessages || isAwayFromLatest) ? <button type="button" onClick={() => { forceNextScrollRef.current = true; scrollToBottom({ force: true }); }} className="absolute bottom-24 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-violet-200/25 bg-[#191522]/95 px-3 py-1.5 text-[11px] font-semibold text-violet-100 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur transition-colors hover:bg-[#231b31]">{hasUnreadMessages ? "Nouveaux messages" : "Revenir au dernier message"}<ArrowDown className="size-3" /></button> : null}

      {suggestedPrompts?.length ? <div className="mx-auto flex w-full max-w-2xl shrink-0 gap-2 overflow-x-auto px-3 pt-2 [scrollbar-width:none] sm:px-4">{suggestedPrompts.map(prompt => <button key={prompt} type="button" onClick={() => { setInput(prompt); textareaRef.current?.focus(); }} disabled={isLoading} className="shrink-0 rounded-full border border-violet-200/15 bg-violet-400/[0.07] px-3 py-1.5 text-[11px] font-medium text-violet-100/80 transition-colors hover:border-violet-200/30 hover:bg-violet-400/[0.14] hover:text-white disabled:opacity-50">{prompt}</button>)}</div> : null}
      <form onSubmit={handleSubmit} className="group relative mx-auto mb-3 mt-2 w-[calc(100%-1.5rem)] max-w-2xl shrink-0 rounded-[1.35rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(26,26,38,0.98),rgba(18,18,28,0.96))] p-1 shadow-[0_16px_42px_rgba(0,0,0,0.35)] transition-all duration-200 focus-within:border-violet-300/35 focus-within:shadow-[0_18px_46px_rgba(76,29,149,0.22)] sm:w-[calc(100%-2rem)]">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-200/25 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100" />
        {attachment ? (
          <div className="mx-2 mt-2 flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.09] px-2.5 py-2 text-[11px] text-violet-100">
            <ImagePlus className="size-3.5 text-violet-200" />
            <span className="min-w-0 flex-1 truncate font-medium">{attachment.name}</span>
            <button type="button" onClick={() => setAttachment(null)} className="rounded-md p-1 text-violet-100 transition-colors hover:bg-white/10" aria-label="Retirer l’image">
              <X className="size-3" />
            </button>
          </div>
        ) : null}
        {attachmentError ? <p className="mx-2 mt-2 text-[11px] text-red-300">{attachmentError}</p> : null}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          id="lakay-builder-image"
          onChange={event => {
            const file = event.currentTarget.files?.[0] || null;
            if (!file) return;
            if (file.size > 5_000_000) {
              setAttachmentError("Choisissez une image de 5 Mo maximum.");
              return;
            }
            setAttachment(file);
            setAttachmentError(null);
            event.currentTarget.value = "";
          }}
        />
        <label htmlFor="lakay-builder-image" className="absolute bottom-1.5 left-1.5 grid size-9 cursor-pointer place-items-center rounded-xl text-zinc-500 transition-all hover:bg-violet-300/[0.09] hover:text-violet-100" title="Ajouter une image">
          <ImagePlus className="size-4" />
        </label>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-12 max-h-28 resize-none border-0 bg-transparent py-3 pl-12 pr-14 text-sm text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0"
          rows={1}
        />
        <button
          type="submit"
          aria-label="Envoyer le message"
          disabled={(!input.trim() && !attachment) || isLoading}
          className="absolute bottom-1.5 right-1.5 grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-200 to-fuchsia-300 text-zinc-950 shadow-[0_8px_18px_rgba(167,139,250,0.24)] transition-all hover:scale-105 hover:shadow-[0_12px_24px_rgba(217,70,239,0.28)] active:scale-95 disabled:bg-white/[0.07] disabled:text-zinc-600 disabled:shadow-none"
        >
          <Loader2 className={cn("size-4 animate-spin", isLoading ? "" : "hidden")} />
          <Send className={cn("size-4", isLoading ? "hidden" : "")} />
        </button>
      </form>
    </div>
  );
}
