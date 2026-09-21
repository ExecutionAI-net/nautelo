"use client";

import { createContext, useContext, useMemo } from "react";

import { makeTranslate, type Messages, type Translate } from "@/i18n";

const MessagesContext = createContext<Messages | null>(null);

/** The published text the browser-side components need (only the groups listed in CLIENT_GROUPS travel to the browser). */
export function MessagesProvider({ messages, children }: { messages: Messages; children: React.ReactNode }) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

/** `t` for client components. Text outside CLIENT_GROUPS is not sent to the browser: use the server `getT` for it. */
export function useT(): Translate {
  const messages = useContext(MessagesContext);
  return useMemo(() => makeTranslate(messages), [messages]);
}
