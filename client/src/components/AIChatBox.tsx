import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Eye, ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type AIChatBoxProps = { messages: Message[]; onSendMessage: (content: string, imageKey?: string) => void; onUploadImage?: (file: File) => Promise<string>; onOpenPreview?: () => void; isLoading?: boolean; loadingMessage?: string; placeholder?: string; className?: string; height?: string | number; emptyStateMessage?: string; suggestedPrompts?: string[]; showLoadingIndicator?: boolean };

export function AIChatBox({ messages, onSendMessage, onUploadImage, onOpenPreview, isLoading = false, loadingMessage = "Lakay construit les fichiers et prépare l’aperçu…", placeholder = "Écrivez votre message…", className, height = "600px", emptyStateMessage = "Commencez à créer avec Lakay.", suggestedPrompts, showLoadingIndicator = true }: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);
  const displayMessages = messages.filter(message => message.role !== "system");
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    requestAnimationFrame(() => viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" }));
  };
  useEffect(() => {
    scrollToBottom();
  }, [displayMessages.length, isLoading]);
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
      onSendMessage(content, imageKey);
      setInput("");
      setAttachment(null);
      setAttachmentError(null);
      scrollToBottom();
      textareaRef.current?.focus();
    } catch (error) {
      submittingRef.current = false;
      setAttachmentError(error instanceof Error ? error.message : "L’image n’a pas pu être ajoutée.");
    }
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); handleSubmit(event); }
  };
  const sendSuggestedPrompt = (prompt: string) => {
    if (isLoading || submittingRef.current) return;
    submittingRef.current = true;
    onSendMessage(prompt);
    scrollToBottom();
    textareaRef.current?.focus();
  };

  return <div className={cn("flex flex-col bg-transparent text-zinc-100", className)} style={{ height }}>
    <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-hidden">{displayMessages.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-5 text-center"><Sparkles className="size-5 text-violet-300/60" /><p className="mt-3 text-sm text-zinc-500">{emptyStateMessage}</p>{suggestedPrompts?.length ? <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-2">{suggestedPrompts.map(prompt => <button key={prompt} type="button" onClick={() => sendSuggestedPrompt(prompt)} disabled={isLoading} className="rounded-full bg-white/[0.045] px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200 disabled:opacity-50">{prompt}</button>)}</div> : null}</div> : <ScrollArea className="h-full"><div className="space-y-5 px-4 py-5 sm:px-5">{displayMessages.map((message, index) => { const hasPreviewAction = message.role === "assistant" && message.content.includes("[[lakay:open-preview]]"); const content = message.content.replace("[[lakay:open-preview]]", "").trim(); return <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[88%] text-sm leading-6", message.role === "user" ? "rounded-2xl bg-violet-400/14 px-3.5 py-2.5 text-violet-50" : "py-1 text-zinc-300")} >{message.role === "assistant" ? <><div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-6"><Streamdown>{content}</Streamdown></div>{hasPreviewAction && onOpenPreview ? <button type="button" onClick={onOpenPreview} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-400 px-3 text-xs font-semibold text-zinc-950 transition-colors hover:bg-violet-300"><Eye className="size-3.5" />Voir l’aperçu</button> : null}</> : <p className="whitespace-pre-wrap">{content}</p>}</div></div>; })}{isLoading && showLoadingIndicator ? <div aria-live="polite" className="flex items-center gap-2 py-1 text-xs text-zinc-500"><Loader2 className="size-3.5 animate-spin text-violet-300" />{loadingMessage}</div> : null}</div></ScrollArea>}</div>
    <form onSubmit={handleSubmit} className="relative mx-3 mb-3 mt-2 rounded-2xl bg-[#171720] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:mx-4">{attachment ? <div className="mx-2 mt-2 flex items-center gap-2 rounded-lg bg-violet-400/10 px-2.5 py-1.5 text-[11px] text-violet-100"><ImagePlus className="size-3.5 text-violet-300" /><span className="min-w-0 flex-1 truncate">{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} className="rounded p-0.5 text-violet-200 hover:bg-white/10" aria-label="Retirer l’image"><X className="size-3" /></button></div> : null}{attachmentError ? <p className="mx-2 mt-2 text-[11px] text-red-300">{attachmentError}</p> : null}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" id="lakay-builder-image" onChange={event => { const file = event.currentTarget.files?.[0] || null; if (!file) return; if (file.size > 5_000_000) { setAttachmentError("Choisissez une image de 5 Mo maximum."); return; } setAttachment(file); setAttachmentError(null); event.currentTarget.value = ""; }} /><label htmlFor="lakay-builder-image" className="absolute bottom-1.5 left-1.5 grid size-8 cursor-pointer place-items-center rounded-xl text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-violet-200" title="Ajouter une image"><ImagePlus className="size-4" /></label><Textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="min-h-11 max-h-28 resize-none border-0 bg-transparent py-2.5 pl-11 pr-12 text-sm text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0" rows={1} /><button type="submit" aria-label="Envoyer le message" disabled={(!input.trim() && !attachment) || isLoading} className="absolute bottom-1.5 right-1.5 grid size-8 place-items-center rounded-xl bg-violet-400 text-zinc-950 transition-colors hover:bg-violet-300 disabled:bg-white/[0.08] disabled:text-zinc-600"><Loader2 className={cn("size-3.5 animate-spin", isLoading ? "" : "hidden")} /><Send className={cn("size-3.5", isLoading ? "hidden" : "")} /></button></form>
  </div>;
}
