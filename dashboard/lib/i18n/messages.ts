import type { AppLocale } from "./config";
import en from "@/messages/en.json";
import km from "@/messages/km.json";
import ko from "@/messages/ko.json";

export type Messages = typeof en;

export const messageCatalog: Record<AppLocale, Messages> = {
  en,
  km,
  ko,
};
