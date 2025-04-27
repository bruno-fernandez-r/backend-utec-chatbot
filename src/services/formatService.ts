export function formatearRespuestaGPT(respuesta: string): string {
  return respuesta
    .trim()
    // Encabezados Markdown
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Negrita Markdown
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Código inline
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // ✅ Correos electrónicos como enlaces mailto
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (email) => {
      return `<a href="mailto:${email}">${email}</a>`;
    })
    // ✅ URLs como enlaces clicables
    .replace(/https?:\/\/[^\s\)\]\}\>,;:]*/g, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    })
    // Convierte líneas con "- " en <li>
    .replace(/^- (.*)/gm, "<li>$1</li>")
    // Agrupa bloques consecutivos de <li> en un <ul>
    .replace(/(<li>.*<\/li>(?:\n<li>.*<\/li>)*)/g, "<ul>$1</ul>")
    // Párrafos y saltos de línea
    .replace(/\n{2,}/g, "</p><p>") // Doble salto = nuevo párrafo
    .replace(/\n/g, "<br>")        // Salto de línea simple
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

  