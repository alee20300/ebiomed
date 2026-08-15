"use client"

import { useState } from "react"
import { login, loginWithAuthentik, signup } from "@/lib/actions/profiles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginForm({ next }: { next: string }) {
  const [isSignup, setIsSignup] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">eBiomed</CardTitle>
          <p className="text-sm text-muted-foreground">Biomedical Maintenance Management</p>
        </CardHeader>
        <CardContent>
          <form action={loginWithAuthentik}>
            <input type="hidden" name="next" value={next} />
            <Button type="submit" className="w-full">
              Continue with Authentik
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Local account</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={isSignup ? signup : login} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            {isSignup && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <Button type="submit" className="w-full">
              {isSignup ? "Create Account" : "Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="font-medium text-primary hover:underline"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
