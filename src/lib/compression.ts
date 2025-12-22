import LZString from 'lz-string'

// Prefix marker to identify compressed strings
const COMPRESSED_PREFIX = '\u0000LZ\u0000'

/**
 * Compress a string using LZ-String compression.
 * Useful for storing large message content in IndexedDB.
 * Adds a prefix marker to identify compressed strings.
 */
export function compressString(input: string): string {
  if (!input || input.length < 500) {
    // Don't compress small strings - overhead not worth it
    return input
  }
  const compressed = LZString.compressToUTF16(input)
  // Add prefix to identify this as compressed
  return COMPRESSED_PREFIX + compressed
}

/**
 * Decompress a string that was compressed with compressString.
 * Only decompresses strings that have the compression prefix marker.
 * Returns original string if not compressed.
 */
export function decompressString(input: string): string {
  if (!input) return input

  // Only decompress if it has our prefix marker
  if (!input.startsWith(COMPRESSED_PREFIX)) {
    return input
  }

  try {
    const withoutPrefix = input.slice(COMPRESSED_PREFIX.length)
    const decompressed = LZString.decompressFromUTF16(withoutPrefix)
    // If decompression returns null, return original (shouldn't happen with prefix)
    if (!decompressed) return input
    return decompressed
  } catch {
    // Decompression failed, return original
    return input
  }
}

/**
 * Check if a string is compressed (has our prefix marker).
 */
export function isCompressed(input: string): boolean {
  return input?.startsWith(COMPRESSED_PREFIX) ?? false
}

/**
 * Get compression ratio for a string (for debugging/metrics).
 */
export function getCompressionRatio(original: string): {
  originalSize: number
  compressedSize: number
  ratio: number
} {
  const compressed = LZString.compressToUTF16(original)
  return {
    originalSize: original.length * 2, // UTF-16 bytes
    compressedSize: compressed.length * 2,
    ratio: compressed.length / original.length,
  }
}
