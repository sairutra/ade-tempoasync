import type { ClientMessage } from './protocol'
import type { SocketLike } from './socket'

/** A WebSocket stand-in: open() and drop() simulate the server side. */
export class MockWebSocket implements SocketLike {
  static instances: MockWebSocket[] = []
  readyState = 0
  sent: ClientMessage[] = []
  onopen: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.drop()
  }
  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  /** The connection ends (server gone, network down, or close()). */
  drop() {
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }

  static last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }
}

export const createMockSocket = (url: string) => new MockWebSocket(url)
