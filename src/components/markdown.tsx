import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

// AI answers rendered as Markdown. Raw HTML in the text is not rendered (react-markdown's
// default), so model output can't inject markup. Styled here: the app has no
// typography plugin.
const components: Components = {
  h1: ({ children }) => <h3 className="text-base font-semibold mt-4 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="text-sm font-semibold mt-4 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold mt-3 first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mt-2 first:mt-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
      {children}
    </a>
  ),
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("text-sm break-words", className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
