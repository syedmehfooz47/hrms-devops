import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatService } from "@/services/api";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi there! I'm your Pulse HR Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message to UI immediately
    const updatedMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Send to backend
      const res = await chatService.sendMessage(userMessage, messages);
      if (res.success) {
        setMessages([...updatedMessages, { role: "assistant", content: res.message }]);
      } else {
        throw new Error(res.message || "Failed to get response");
      }
    } catch (error: any) {
      toast.error(error.message || "Error communicating with HR Assistant");
      setMessages([...updatedMessages, { role: "assistant", content: "Sorry, I'm having trouble connecting to the server right now. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] max-h-[80vh] bg-background border rounded-2xl shadow-2xl mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <h3 className="font-semibold">HR Assistant</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary-foreground/20 hover:text-primary-foreground" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[85%] gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`px-4 py-2 rounded-2xl text-sm ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 flex-row">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 bg-muted text-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="px-4 py-2 rounded-2xl text-sm bg-muted text-foreground rounded-tl-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="p-3 border-t bg-card">
            <div className="flex items-center gap-2 relative">
              <input
                type="text"
                placeholder="Ask me anything..."
                className="w-full h-10 px-4 pr-10 rounded-full border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <Button 
                size="icon" 
                className="absolute right-1 h-8 w-8 rounded-full" 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {!isOpen && (
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-105 transition-all duration-300"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
