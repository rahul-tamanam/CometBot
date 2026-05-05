import { useState } from 'react'

export function useFileUpload(uploadUrl: string) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
    }
  }

  const selectFile = (file: File | null) => {
    setSelectedFile(file)
  }

  const uploadFile = async (userId: string, token: string | null): Promise<unknown> => {
    if (!selectedFile) return undefined

    const toBase64 = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = (error) => reject(error)
      })

    try {
      setIsUploading(true)
      const base64_pdf = await toBase64(selectedFile)

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          pdf_content: base64_pdf,
          token,
        }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const detail =
          typeof errBody === 'object' && errBody && 'detail' in errBody
            ? String((errBody as { detail?: unknown }).detail)
            : `Request failed (${response.status})`
        throw new Error(detail)
      }
      return await response.json()
    } catch (error) {
      console.error('Upload error:', error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  return { selectedFile, isUploading, handleFileChange, uploadFile, selectFile }
}

export default useFileUpload
