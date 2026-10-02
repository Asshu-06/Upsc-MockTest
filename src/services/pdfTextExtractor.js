/**
 * pdfTextExtractor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PDF.js text extraction utility with coordinate preservation for selectable PDFs.
 * NO AI/OCR - deterministic extraction only.
 * 
 * Extracts:
 * - Text content
 * - X/Y positions
 * - Page numbers
 * - Text dimensions
 * 
 * Used by text-based MCQ parser for tick-mark detection.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as pdfjsLib from 'pdfjs-dist'

// ─── PDF.js worker setup (done once) ──────────────────────────────────────────
let workerConfigured = false
function ensureWorker() {
  if (workerConfigured) return
  try {
    if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
    workerConfigured = true
  } catch (e) {
    console.warn('[pdfTextExtractor] PDF.js worker setup warning:', e)
  }
}

// ─── Extract text with positions from a single PDF page ──────────────────────
async function extractPageText(pdfPage, pageNumber) {
  const textContent = await pdfPage.getTextContent()
  const viewport = pdfPage.getViewport({ scale: 1.0 })

  const items = textContent.items.map((item, index) => {
    // Extract position information
    const transform = item.transform || [1, 0, 0, 1, 0, 0]
    const x = transform[4]
    const y = transform[5]
    const width = item.width || 0
    const height = item.height || 0

    return {
      text: item.str || '',
      x,
      y,
      width,
      height,
      pageNumber,
      index,
      // Font info (useful for detecting bold/special formatting)
      fontName: item.fontName || '',
    }
  })

  return {
    pageNumber,
    items,
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
  }
}

// ─── Main export: extract text from entire PDF ───────────────────────────────
/**
 * Extract all text with positions from a selectable-text PDF.
 * 
 * @param {File|Blob|ArrayBuffer|string} fileInput - PDF file to extract
 * @param {Function} onProgress - Optional progress callback (pageNum, totalPages)
 * @returns {Promise<ExtractionResult>}
 * 
 * Returns:
 * {
 *   fileName: string,
 *   totalPages: number,
 *   pages: [
 *     {
 *       pageNumber: number,
 *       items: [{ text, x, y, width, height, fontName }],
 *       viewport: { width, height }
 *     }
 *   ],
 *   hasSelectableText: boolean,
 *   warnings: []
 * }
 */
export async function extractPdfText(fileInput, onProgress = null) {
  ensureWorker()

  // ── 1. Load ArrayBuffer ────────────────────────────────────────────────────
  let arrayBuffer
  let fileName = 'document.pdf'

  if (fileInput instanceof File || fileInput instanceof Blob) {
    if (fileInput.size > 50 * 1024 * 1024) {
      throw new Error('PDF exceeds 50MB limit')
    }
    fileName = fileInput.name ?? fileName
    arrayBuffer = await fileInput.arrayBuffer()
  } else if (fileInput instanceof ArrayBuffer) {
    arrayBuffer = fileInput
  } else if (typeof fileInput === 'string') {
    fileName = fileInput.split('/').pop() ?? fileName
    const res = await fetch(fileInput)
    if (!res.ok) throw new Error(`Failed to fetch PDF (HTTP ${res.status})`)
    arrayBuffer = await res.arrayBuffer()
  } else {
    throw new Error('Unsupported input type')
  }

  // ── 2. Load PDF document ───────────────────────────────────────────────────
  let pdfDoc
  try {
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  } catch (err) {
    throw new Error(`PDF.js failed to load document: ${err.message}`)
  }

  const totalPages = pdfDoc.numPages
  const pages = []
  const warnings = []

  // ── 3. Extract text from each page ────────────────────────────────────────
  for (let pn = 1; pn <= totalPages; pn++) {
    if (onProgress) {
      try {
        onProgress(pn, totalPages)
      } catch (e) {
        // Never let progress callback crash extraction
      }
    }

    try {
      const page = await pdfDoc.getPage(pn)
      const pageData = await extractPageText(page, pn)
      pages.push(pageData)
    } catch (err) {
      console.warn(`[pdfTextExtractor] Page ${pn} extraction error:`, err)
      warnings.push(`Page ${pn}: ${err.message}`)
      // Push empty page data to maintain page numbering
      pages.push({
        pageNumber: pn,
        items: [],
        viewport: { width: 0, height: 0 },
      })
    }
  }

  // ── 4. Validate selectable text ───────────────────────────────────────────
  // Check if PDF contains meaningful selectable text
  const totalTextLength = pages.reduce((sum, page) => {
    return sum + page.items.reduce((s, item) => s + (item.text || '').length, 0)
  }, 0)

  const hasSelectableText = totalTextLength > 100 // At least 100 characters

  if (!hasSelectableText) {
    warnings.push(
      'PDF contains minimal or no selectable text. This appears to be a scanned/image PDF. ' +
      'Scanned/image-only PDFs are not supported. Please upload a selectable-text PDF.'
    )
  }

  return {
    fileName,
    totalPages,
    pages,
    hasSelectableText,
    warnings,
  }
}

// ─── Helper: Merge text items that are on the same line ──────────────────────
/**
 * Group text items by vertical position (same line).
 * Useful for reconstructing multi-word lines.
 * 
 * @param {Array} items - Text items from a page
 * @param {number} yTolerance - Y-coordinate tolerance for same line (default: 2)
 * @returns {Array<Array>} - Array of line groups
 */
export function groupItemsByLine(items, yTolerance = 2) {
  if (!items || items.length === 0) return []

  // Sort by Y (top to bottom) then X (left to right)
  const sorted = [...items].sort((a, b) => {
    const yDiff = Math.abs(a.y - b.y)
    if (yDiff > yTolerance) return b.y - a.y // Descending Y (PDF coords)
    return a.x - b.x // Ascending X
  })

  const lines = []
  let currentLine = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]
    const prevItem = currentLine[currentLine.length - 1]

    // Same line if Y difference is within tolerance
    if (Math.abs(item.y - prevItem.y) <= yTolerance) {
      currentLine.push(item)
    } else {
      // New line
      lines.push(currentLine)
      currentLine = [item]
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  return lines
}

// ─── Helper: Reconstruct full text from a line of items ──────────────────────
/**
 * Join text items in a line, adding spaces where appropriate.
 * 
 * @param {Array} lineItems - Items in the same line
 * @returns {string} - Reconstructed line text
 */
export function reconstructLineText(lineItems) {
  if (!lineItems || lineItems.length === 0) return ''

  let result = lineItems[0].text || ''

  for (let i = 1; i < lineItems.length; i++) {
    const curr = lineItems[i]
    const prev = lineItems[i - 1]

    const text = curr.text || ''
    if (!text) continue

    // Add space if there's a gap between items
    const gap = curr.x - (prev.x + prev.width)
    const needsSpace = gap > 1 && !result.endsWith(' ') && !text.startsWith(' ')

    result += (needsSpace ? ' ' : '') + text
  }

  return result.trim()
}

// ─── Helper: Find items near a position (for tick detection) ─────────────────
/**
 * Find text items within a radius of a given position.
 * Useful for finding options near tick marks.
 * 
 * @param {Array} items - All text items on a page
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Search radius
 * @returns {Array} - Items within radius, sorted by distance
 */
export function findNearbyItems(items, x, y, radius = 20) {
  return items
    .map(item => ({
      ...item,
      distance: Math.sqrt(Math.pow(item.x - x, 2) + Math.pow(item.y - y, 2))
    }))
    .filter(item => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
}
