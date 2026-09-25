"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

import { useLocaleOrDefault } from "@/components/layout/LocaleContext";
import { localizePath } from "@/lib/i18n/localePath";

/** next/link that keeps the visitor in their language: /boats/ becomes /it/boats/ on an Italian page. */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocaleOrDefault();
  const target =
    typeof href === "string"
      ? localizePath(href, locale)
      : href.pathname
        ? { ...href, pathname: localizePath(href.pathname, locale) }
        : href;
  return <NextLink href={target} {...rest} />;
}
