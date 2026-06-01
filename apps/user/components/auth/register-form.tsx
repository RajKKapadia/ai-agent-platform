"use client";

import { registerAction, type AuthActionState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          autoComplete="name"
          id="name"
          name="name"
          placeholder="Logan"
          required
        />
        {state.fieldErrors?.name?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
        {state.fieldErrors?.email?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          name="password"
          placeholder="At least 8 characters"
          required
          type="password"
        />
        {state.fieldErrors?.password?.[0] ? (
          <p className="text-sm text-red-600">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create account
      </Button>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link className="font-medium text-zinc-950 underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}
