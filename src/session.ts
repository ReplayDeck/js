const ID_KEY = "rd.sid"
const SEQ_KEY = "rd.seq"

function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export class Session {
  id: string
  seq: number

  constructor(private store: Storage = sessionStorage) {
    this.id = store.getItem(ID_KEY) || newId()
    const stored = Number(store.getItem(SEQ_KEY))
    this.seq = Number.isFinite(stored) && stored >= 0 ? stored : 0
    this.persist()
  }

  advance(): void {
    this.seq += 1
    this.store.setItem(SEQ_KEY, String(this.seq))
  }

  rotate(): void {
    this.id = newId()
    this.seq = 0
    this.persist()
  }

  private persist(): void {
    this.store.setItem(ID_KEY, this.id)
    this.store.setItem(SEQ_KEY, String(this.seq))
  }
}
