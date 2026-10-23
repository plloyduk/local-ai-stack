import { ClerkProvider, SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <ClerkProvider>
      <div className="min-h-screen flex items-center justify-center">
        <SignUp />
      </div>
    </ClerkProvider>
  );
}
