'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const MIN_HEIGHT_TO_COLLAPSE = 250 // only collapse if taller than this

interface CollapsibleCodeBlocksProps {
  children: React.ReactNode
  className?: string
}

let blockIdCounter = 0

function processCodeBlock(blockElement: HTMLElement) {
  // Skip if already has a button
  if (blockElement.querySelector('.code-block-toggle-btn')) return

  const bodyElement = blockElement.querySelector(
    'pre[data-streamdown="code-block-body"]',
  ) as HTMLElement

  if (!bodyElement) return

  // Check if the code block is tall enough to need collapsing
  // Use scrollHeight to get the natural height
  const naturalHeight = bodyElement.scrollHeight
  if (naturalHeight <= MIN_HEIGHT_TO_COLLAPSE) return

  // Generate unique ID for this block
  const blockId = `code-block-${++blockIdCounter}`
  blockElement.dataset.collapsibleId = blockId
  blockElement.dataset.expanded = 'false'
  blockElement.classList.add('collapsible-code-block')

  // Create the expand/collapse button container
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'code-block-toggle-container'

  const button = document.createElement('button')
  button.className = 'code-block-toggle-btn'
  button.textContent = 'Expand'
  button.type = 'button'
  button.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const isExpanded = blockElement.dataset.expanded === 'true'
    blockElement.dataset.expanded = String(!isExpanded)
    button.textContent = isExpanded ? 'Expand' : 'Collapse'
  })

  buttonContainer.appendChild(button)
  blockElement.appendChild(buttonContainer)
}

function processAllCodeBlocks(container: HTMLElement) {
  const codeBlocks = container.querySelectorAll(
    'div[data-streamdown="code-block"]',
  )
  codeBlocks.forEach((block) => {
    processCodeBlock(block as HTMLElement)
  })
}

export function CollapsibleCodeBlocks({
  children,
  className,
}: CollapsibleCodeBlocksProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Process existing code blocks after a small delay to ensure Shiki has rendered
    const initialTimeout = setTimeout(() => {
      processAllCodeBlocks(container)
    }, 100)

    // Also process again after a longer delay to catch late-rendered blocks
    const secondTimeout = setTimeout(() => {
      processAllCodeBlocks(container)
    }, 500)

    // Use MutationObserver to detect new code blocks being added
    const observer = new MutationObserver((mutations) => {
      let hasNewCodeBlocks = false
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              // Check if the added node is a code block or contains code blocks
              if (node.dataset?.streamdown === 'code-block') {
                hasNewCodeBlocks = true
                break
              }
              if (node.querySelector?.('div[data-streamdown="code-block"]')) {
                hasNewCodeBlocks = true
                break
              }
            }
          }
        }
        // Also check for attribute changes (Shiki adds classes/attributes when done)
        if (mutation.type === 'attributes' || mutation.type === 'characterData') {
          hasNewCodeBlocks = true
        }
        if (hasNewCodeBlocks) break
      }

      if (hasNewCodeBlocks) {
        // Debounce processing
        setTimeout(() => {
          processAllCodeBlocks(container)
        }, 50)
      }
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })

    return () => {
      clearTimeout(initialTimeout)
      clearTimeout(secondTimeout)
      observer.disconnect()
    }
  }, [])

  // Also re-process when children change significantly
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Small delay to let React finish rendering
    const timeout = setTimeout(() => {
      processAllCodeBlocks(container)
    }, 150)

    return () => clearTimeout(timeout)
  }, [children])

  return (
    <div ref={containerRef} className={cn('collapsible-code-wrapper', className)}>
      {children}
    </div>
  )
}
