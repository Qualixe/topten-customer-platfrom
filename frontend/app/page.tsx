import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-black">
      <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
        TopTen Customer Platform
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        System is running successfully.
      </p>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        Go to Dashboard
      </Button>
    </div>
  );
}
