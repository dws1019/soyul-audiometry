/** Audiogram SVG → PNG Blob (브라우저 안에서 변환, 외부 전송 없음) */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[data-export="exclude"]').forEach((el) => el.remove())
  const vb = svg.viewBox.baseVal
  const width = vb?.width || svg.clientWidth || 640
  const height = vb?.height || svg.clientHeight || 440
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const source = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Audiogram 이미지를 만들 수 없습니다.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const g = canvas.getContext('2d')
    if (!g) throw new Error('Canvas를 사용할 수 없습니다.')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 변환 실패'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
