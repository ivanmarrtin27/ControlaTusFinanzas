/**
 * Campo de ticket en el formulario de movimiento.
 * Preview local del archivo pendiente; para el path ya guardado pide URL firmada.
 * El upload real ocurre al guardar el movimiento (TransactionForm → receiptApi).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { createReceiptSignedUrl, validateReceiptFile } from '@/lib/receiptApi'
import { MoneyApiError } from '@/lib/moneyApi'

interface ReceiptFieldProps {
  /** Path en Storage (edición). */
  receiptPath: string | null
  /** Archivo local pendiente de subir. */
  file: File | null
  onFileChange: (file: File | null) => void
  onClearExisting: () => void
  /** El usuario pidió quitar el ticket existente. */
  clearExisting: boolean
}

export function ReceiptField({
  receiptPath,
  file,
  onFileChange,
  onClearExisting,
  clearExisting,
}: ReceiptFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingSigned, setLoadingSigned] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!receiptPath || clearExisting || file) {
        setSignedUrl(null)
        return
      }
      setLoadingSigned(true)
      try {
        const url = await createReceiptSignedUrl(receiptPath)
        if (!cancelled) setSignedUrl(url)
      } catch {
        if (!cancelled) setSignedUrl(null)
      } finally {
        if (!cancelled) setLoadingSigned(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [receiptPath, clearExisting, file])

  function handlePick(fileList: FileList | null) {
    setError(null)
    const next = fileList?.[0] ?? null
    if (!next) return
    try {
      validateReceiptFile(next)
      onFileChange(next)
    } catch (err) {
      setError(err instanceof MoneyApiError || err instanceof Error ? err.message : 'Archivo no válido.')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const thumbSrc = previewUrl ?? (!clearExisting ? signedUrl : null)
  const hasExisting = Boolean(receiptPath) && !clearExisting && !file

  return (
    <div className="field receipt-field">
      <span className="field-label">Foto del ticket</span>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Cámara o galería · máx. 5 MB · JPEG/PNG/WebP/HEIC
      </p>

      {thumbSrc ? (
        <div className="receipt-thumb-wrap">
          <a href={thumbSrc} target="_blank" rel="noreferrer" className="receipt-thumb-link">
            <img src={thumbSrc} alt="Vista previa del ticket" className="receipt-thumb" />
          </a>
        </div>
      ) : loadingSigned ? (
        <p className="muted" style={{ fontSize: '0.8rem' }}>
          Cargando foto…
        </p>
      ) : null}

      <div className="header-actions" style={{ marginTop: '0.35rem' }}>
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          {hasExisting || file ? 'Cambiar foto' : 'Añadir foto'}
        </Button>
        {file || hasExisting ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onFileChange(null)
              if (hasExisting) onClearExisting()
              if (inputRef.current) inputRef.current.value = ''
              setError(null)
            }}
          >
            Quitar
          </Button>
        ) : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handlePick(e.target.files)}
      />

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
