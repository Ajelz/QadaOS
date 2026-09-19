import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-[480px] flex-col justify-center gap-4 px-4 py-10 safe-top">
      <div className="brut inline-block w-fit rounded-[14px] bg-yellow px-4 py-3">
        <h1 className="display text-[28px]">Nothing here</h1>
      </div>
      <Link href="/" className="brut pressable inline-flex w-fit rounded-[12px] bg-paper px-4 py-3 text-[15px] font-extrabold">
        Back to Today
      </Link>
    </main>
  );
}
