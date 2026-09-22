import { MessagesProvider } from "./client";
import seed from "./seed.json";
import { makeTranslate, type Messages, type Translate } from "./index";

/** Published text for a language as the tests see it: the hand-written translations that ship with the code. */
export function testMessages(locale: string): Messages {
  return (seed as Record<string, Messages>)[locale] ?? {};
}

/** `t` for a language, without a server; English when the language has no seed. */
export function testT(locale: string = "en"): Translate {
  return makeTranslate(testMessages(locale));
}

/** Wrap a client component in the published text of a language (what the layout does on the real site). */
export function withMessages(locale: string, ui: React.ReactNode) {
  return <MessagesProvider messages={testMessages(locale)}>{ui}</MessagesProvider>;
}
