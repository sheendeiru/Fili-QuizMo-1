"use client";

import Link, { useLinkStatus } from "next/link";
import {
  useEffect,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useOptionalNavigation } from "./navigation-provider";

type NavLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode;
  pendingClassName?: string;
};

function LinkStatus({ id, children, pendingClassName }: {
  id: string;
  children: ReactNode;
  pendingClassName?: string;
}) {
  const { pending } = useLinkStatus();
  const navigation = useOptionalNavigation();
  const setLinkPending = navigation?.setLinkPending;

  useEffect(() => {
    setLinkPending?.(id, pending);
    return () => setLinkPending?.(id, false);
  }, [id, pending, setLinkPending]);

  return (
    <span
      aria-busy={pending || undefined}
      className={`relative inline-flex items-center ${pending ? pendingClassName ?? "opacity-70" : ""}`}
    >
      {children}
      <span
        aria-hidden="true"
        className={`pixel-spinner invisible absolute left-full top-1/2 ml-2 h-3 w-3 -translate-y-1/2 text-current ${pending ? "visible" : ""}`}
      >
        <span />
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

export function NavLink({
  children,
  className,
  pendingClassName,
  onClick,
  ...props
}: NavLinkProps) {
  const id = useId();
  const navigation = useOptionalNavigation();
  const pending = navigation?.isLinkPending(id) ?? false;
  return (
    <Link
      className={className}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      <LinkStatus
        id={id}
        pendingClassName={pendingClassName}
      >
        {children}
      </LinkStatus>
    </Link>
  );
}
