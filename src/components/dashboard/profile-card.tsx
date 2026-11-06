"use client";

import { useEffect, useState } from "react";
import { PixelCard } from "@/components/ui/pixel-primitives";
import { createClient } from "@/lib/supabase/client";

type ProfileRole = "teacher" | "admin";

type Profile = {
  name: string | null;
  email: string;
  status: string | null;
  since: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

/**
 * The signed-in teacher's or admin's real account details, read from the
 * teachers / admins tables. Nothing here is editable on purpose: the username
 * is copied into quiz and result rows, and the email is the sign-in identity,
 * so changing either needs a server-side update across several tables.
 */
export function ProfileCard({ role }: { role: ProfileRole }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Unable to load your profile. Sign in again.");
        }

        if (role === "teacher") {
          const { data, error } = await supabase
            .from("teachers")
            .select("username, email, status, created_at")
            .eq("user_id", user.id)
            .maybeSingle();

          if (error) throw new Error(error.message);
          if (!active) return;

          setProfile({
            name: data?.username ?? null,
            email: data?.email ?? user.email ?? "",
            status: data?.status ?? null,
            since: data?.created_at ?? null,
          });
          return;
        }

        const { data, error } = await supabase
          .from("admins")
          .select("email, created_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!active) return;

        setProfile({
          name: null,
          email: data?.email ?? user.email ?? "",
          status: null,
          since: data?.created_at ?? null,
        });
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load your profile.",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [role]);

  return (
    <PixelCard className="max-w-2xl">
      <h3 className="text-lg font-semibold text-foreground">
        {role === "teacher" ? "Teacher profile" : "Admin profile"}
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        These details come from your account. Ask an administrator if
        something needs to change.
      </p>

      {isLoading ? (
        <p role="status" className="mt-3 text-sm text-neutral-600">
          Loading your profile...
        </p>
      ) : errorMessage ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : profile ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {role === "teacher" ? (
            <Field label="Username" value={profile.name ?? "—"} />
          ) : (
            <Field label="Role" value="Administrator" />
          )}
          <Field label="Email" value={profile.email || "—"} />
          {profile.status ? (
            <Field label="Account status" value={statusLabel(profile.status)} />
          ) : null}
          <Field label="Member since" value={formatDate(profile.since)} />
        </dl>
      ) : null}
    </PixelCard>
  );
}
