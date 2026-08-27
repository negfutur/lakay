import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
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
  const displayMessages = messages.filter(message => {
    if (message.role === "system") return false;
    if (message.role === "assistant" && /^\s*Contexte interne Lakay\s*:/i.test(message.content)) return false;
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
            <div className="space-y-4 px-4 py-4 sm:px-6">
              {displayMessages.map((message, index) => {
                const hasPreviewAction = message.role === "assistant" && message.content.includes("[[lakay:open-preview]]");
                const content = message.content.replace("[[lakay:open-preview]]", "").trim();
                const assistant = message.role === "assistant";

                return (
                  <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[88%] text-sm leading-6 sm:max-w-[82%]",
                        message.role === "user"
                          ? "ml-auto py-1 text-left text-violet-100"
                          : "min-w-0 py-1 text-zinc-300",
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
                        <>
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100/60">Vous</p>
                          <p className="whitespace-pre-wrap">{content}</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && showLoadingIndicator ? (
                <div aria-live="polite" className="px-1 py-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-violet-100">
                    <span className="flex gap-1">
                      <i className="size-1.5 animate-bounce rounded-full bg-violet-200 [animation-delay:-0.2s]" />
                      <i className="size-1.5 animate-bounce rounded-full bg-fuchsia-200 [animation-delay:-0.1s]" />
                      <i className="size-1.5 animate-bounce rounded-full bg-violet-200" />
                    </span>
                    <span>Lakay travaille…</span><span className="text-violet-100/55">{loadingMessage}</span>
                  </div>
                  {workStages?.length ? <details className="mt-1.5 pl-5"><summary className="cursor-pointer text-[10px] font-medium text-violet-100/60 transition-colors hover:text-violet-100">Voir les détails</summary><div className="mt-2 flex flex-wrap gap-1.5">{workStages.map(stage => <span key={stage.label} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors", stage.state === "complete" ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100" : stage.state === "active" ? "border-violet-200/30 bg-violet-200/[0.12] text-violet-50" : "border-white/[0.07] bg-white/[0.025] text-violet-100/40") }><i className={cn("size-1.5 rounded-full", stage.state === "complete" ? "bg-emerald-300" : stage.state === "active" ? "animate-pulse bg-violet-200" : "bg-zinc-600")} />{stage.label}</span>)}</div></details> : null}
                </div>
              ) : null}

              {backgroundTask ? (
                <div aria-live="polite" className="relative overflow-hidden rounded-2xl border border-sky-200/15 bg-[linear-gradient(120deg,rgba(14,165,233,0.10),rgba(139,92,246,0.08))] px-4 py-3.5 shadow-[0_16px_40px_rgba(14,116,144,0.12)]">
                  <div className="relative flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-sky-200/20 bg-sky-300/[0.10]"><Loader2 className="size-3.5 animate-spin text-sky-100" /></span>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-sky-50">Tâche persistante · {backgroundTask.status === "queued" ? "En attente" : backgroundTask.status === "requires_action" ? "Action requise" : "En cours"}</p><p className="mt-1 text-[11px] leading-5 text-sky-100/65">{backgroundTask.progress}</p><p className="mt-1 text-[10px] text-sky-100/45">Vous pouvez fermer cette page : Lakay retrouvera la tâche à votre retour.</p></div>
                  </div>
                  {backgroundTask.onCancel ? <button type="button" onClick={backgroundTask.onCancel} className="relative mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-200/20 bg-white/[0.055] px-2.5 text-[11px] font-semibold text-sky-50 transition-colors hover:bg-sky-200/10"><X className="size-3" />Annuler la tâche</button> : null}
                </div>
              ) : null}

              {error ? (
                <div className="relative overflow-hidden rounded-2xl border border-rose-300/18 bg-[linear-gradient(125deg,rgba(244,63,94,0.10),rgba(124,58,237,0.045))] px-4 py-3.5 shadow-[0_16px_40px_rgba(76,29,149,0.10)]">
                  <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-rose-200/80 via-fuchsia-200/25 to-transparent" />
                  <div className="relative flex gap-2.5">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-rose-200/20 bg-rose-300/[0.09]"><AlertTriangle className="size-3.5 text-rose-100" /></span>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-rose-50">{error.title}</p><p className="mt-1 text-[11px] leading-5 text-rose-100/65">{error.detail}</p></div>
                  </div>
                  {error.onRetry ? <button type="button" onClick={error.onRetry} disabled={isLoading} className="relative mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200/20 bg-white/[0.055] px-2.5 text-[11px] font-semibold text-rose-50 transition-colors hover:bg-rose-200/10 disabled:cursor-wait disabled:opacity-55"><RotateCcw className={cn("size-3", isLoading && "animate-spin")} />{isLoading ? "Relance en cours…" : "Réessayer la modification"}</button> : null}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </div>

      {hasUnreadMessages ? <button type="button" onClick={() => { forceNextScrollRef.current = true; scrollToBottom({ force: true, smooth: true }); }} className="absolute bottom-24 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-violet-200/25 bg-[#191522]/95 px-3 py-1.5 text-[11px] font-semibold text-violet-100 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur hover:bg-[#231b31]">Nouveaux messages <ChevronRight className="size-3" /></button> : null}

      {suggestedPrompts?.length ? <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pt-2 [scrollbar-width:none] sm:px-4">{suggestedPrompts.map(prompt => <button key={prompt} type="button" onClick={() => { setInput(prompt); textareaRef.current?.focus(); }} disabled={isLoading} className="shrink-0 rounded-full border border-violet-200/15 bg-violet-400/[0.07] px-3 py-1.5 text-[11px] font-medium text-violet-100/80 transition-colors hover:border-violet-200/30 hover:bg-violet-400/[0.14] hover:text-white disabled:opacity-50">{prompt}</button>)}</div> : null}
      <form onSubmit={handleSubmit} className="group relative mx-3 mb-3 mt-2 shrink-0 rounded-[1.35rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(26,26,38,0.98),rgba(18,18,28,0.96))] p-1 shadow-[0_16px_42px_rgba(0,0,0,0.35)] transition-all duration-200 focus-within:border-violet-300/35 focus-within:shadow-[0_18px_46px_rgba(76,29,149,0.22)] sm:mx-4">
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
