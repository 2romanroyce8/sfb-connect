/** Typed outbound error (code → HTTP status). Lives here so library.ts and engine.ts can share it without a circular import. */
export class OutboundError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }
