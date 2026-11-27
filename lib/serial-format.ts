// Display formatting for serials. Kept separate from lib/serial so client
// components can import it without pulling in Node's crypto module.
export function formatSerialId(serialId: string): string {
  if (serialId.length === 12) {
    return `${serialId.slice(0, 4)}-${serialId.slice(4, 8)}-${serialId.slice(8, 12)}`
  }
  if (serialId.length === 6) {
    return `${serialId.slice(0, 3)}-${serialId.slice(3, 6)}`
  }
  return serialId
}
