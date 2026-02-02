"use client";

const EXAMPLES = [
  "Login flow with Auth0",
  "AWS serverless API",
  "How Argo CD deployment works",
];

interface WelcomeStateProps {
  onExampleClick: (prompt: string) => void;
}

export function WelcomeState({ onExampleClick }: WelcomeStateProps) {
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2" aria-hidden>
      {EXAMPLES.map((example) => (
        <button
          key={example}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onExampleClick(example);
          }}
          className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
        >
          {example}
        </button>
      ))}
    </div>
  );
}
