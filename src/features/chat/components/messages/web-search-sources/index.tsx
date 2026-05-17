import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Globe02Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'
import { useState } from 'react'
import type { WebSearchSource } from '../utils/chat-message-utils'
import { cn } from '@/lib/utils'

interface WebSearchSourcesProps {
  sources: Array<WebSearchSource>
  isStreaming: boolean
}

function faviconUrl(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}

function SourceCard({ source }: { source: WebSearchSource }) {
  const [iconBroken, setIconBroken] = useState(false)
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 items-start gap-2.5 rounded-md border border-border/60 bg-card/60 px-2.5 py-2 transition-colors hover:bg-accent/60 hover:border-border"
      title={source.url}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted/60">
        {iconBroken ? (
          <HugeiconsIcon
            icon={Globe02Icon}
            size={10}
            strokeWidth={2}
            className="text-muted-foreground"
          />
        ) : (
          <img
            src={faviconUrl(source.domain)}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
            loading="lazy"
            onError={() => setIconBroken(true)}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-1 text-xs font-medium text-foreground group-hover:text-foreground">
          {source.title}
        </span>
        <span className="line-clamp-1 text-[11px] text-muted-foreground">
          {source.domain}
        </span>
      </div>
    </a>
  )
}

export function WebSearchSources({
  sources,
  isStreaming,
}: WebSearchSourcesProps) {
  const [expanded, setExpanded] = useState(false)
  const count = sources.length
  const hasSources = count > 0
  const canExpand = !isStreaming && hasSources

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          if (canExpand) setExpanded((prev) => !prev)
        }}
        disabled={!canExpand}
        aria-expanded={expanded}
        className={cn(
          'group inline-flex w-fit items-center gap-2 rounded-md text-xs font-medium text-muted-foreground transition-colors',
          canExpand && 'cursor-pointer hover:text-foreground',
        )}
      >
        <HugeiconsIcon
          icon={isStreaming ? Loading03Icon : Globe02Icon}
          size={14}
          strokeWidth={2}
          className={cn(
            'text-muted-foreground/60 transition-colors',
            canExpand && 'group-hover:text-foreground',
            isStreaming && 'animate-spin',
          )}
        />
        {isStreaming ? (
          <span className="bg-linear-to-r from-foreground/40 via-foreground/90 to-foreground/40 bg-size-[200%_100%] bg-clip-text text-transparent animate-pulse">
            Searching the web
          </span>
        ) : (
          <>
            <span>
              Searched the web
              {count > 0
                ? ` · ${count} source${count === 1 ? '' : 's'}`
                : ''}
            </span>
            {canExpand ? (
              <HugeiconsIcon
                icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
                size={12}
                strokeWidth={2}
                className="text-muted-foreground/60 transition-colors group-hover:text-foreground"
              />
            ) : null}
          </>
        )}
      </button>
      {expanded && hasSources ? (
        <div className="max-h-52 overflow-y-auto">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {sources.map((source) => (
              <SourceCard key={source.url} source={source} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
