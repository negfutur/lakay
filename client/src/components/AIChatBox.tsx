import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type AIChatBoxProps = { messages: Message[]; onSendMessage: (content: string) => void; isLoading?: boolean; loadingMessage?: string; placeholder?: string; className?: string; height?: string | number; emptyStateMessage?: string; suggestedPrompts?: string[]; showLoadingIndicator?: boolean };

export function AIChatBox({ messages, onSendMessage, isLoading = false, loadingMessage = "Lakay construit les fichiers et prépare l’aperçu…", placeholder = "Écrivez votre message…", className, height = "600px", emptyStateMessage = "Commencez à créer avec Lakay.", suggestedPrompts, showLoadingIndicator = true }: AIChatBoxProps) {
  const [input, setInput] = useState("");
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
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || isLoading || submittingRef.current) return;
    submittingRef.current = true;
    onSendMessage(content);
    setInput("");
    scrollToBottom();
    textareaRef.current?.focus();
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
    <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-hidden">{displayMessages.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-5 text-center"><Sparkles className="size-5 text-violet-300/60" /><p className="mt-3 text-sm text-zinc-500">{emptyStateMessage}</p>{suggestedPrompts?.length ? <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-2">{suggestedPrompts.map(prompt => <button key={prompt} type="button" onClick={() => sendSuggestedPrompt(prompt)} disabled={isLoading} className="rounded-full bg-white/[0.045] px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200 disabled:opacity-50">{prompt}</button>)}</div> : null}</div> : <ScrollArea className="h-full"><div className="space-y-5 px-4 py-5 sm:px-5">{displayMessages.map((message, index) => <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[88%] text-sm leading-6", message.role === "user" ? "rounded-2xl bg-violet-400/14 px-3.5 py-2.5 text-violet-50" : "py-1 text-zinc-300")} >{message.role === "assistant" ? <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-6"><Streamdown>{message.content}</Streamdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}</div></div>)}{isLoading && showLoadingIndicator ? <div aria-live="polite" className="flex items-center gap-2 py-1 text-xs text-zinc-500"><Loader2 className="size-3.5 animate-spin text-violet-300" />{loadingMessage}</div> : null}</div></ScrollArea>}</div>
    <form onSubmit={handleSubmit} className="relative mx-3 mb-3 mt-2 rounded-2xl bg-[#171720] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:mx-4"><Textarea ref={textareaRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="min-h-11 max-h-28 resize-none border-0 bg-transparent py-2.5 pl-3 pr-12 text-sm text-zinc-100 shadow-none placeholder:text-zinc-600 focus-visible:ring-0" rows={1} /><button type="submit" aria-label="Envoyer le message" disabled={!input.trim() || isLoading} className="absolute bottom-1.5 right-1.5 grid size-8 place-items-center rounded-xl bg-violet-400 text-zinc-950 transition-colors hover:bg-violet-300 disabled:bg-white/[0.08] disabled:text-zinc-600"><Loader2 className={cn("size-3.5 animate-spin", isLoading ? "" : "hidden")} /><Send className={cn("size-3.5", isLoading ? "hidden" : "")} /></button></form>
  </div>;
}
