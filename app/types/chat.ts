export interface Message {
  role: "user" | "system" | "assistant";
  content: string;
  reasoning?: {
    collapsed: boolean;
    content: string;
  };
}

export interface Conversation {
  id?: number;
  title: string;
  messages: Message[];
}

export type Theme = "light" | "dark" | "system";
