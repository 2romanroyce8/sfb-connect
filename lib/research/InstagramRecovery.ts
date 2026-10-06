// Thin compatibility layer: Instagram was the first platform to get
// public-index recovery; the implementation now lives in sources/ and is
// shared by every social adapter.
import type { DiscoveryProvider, DiscoveryResult } from "./providers/types";
import { instagramAdapter } from "./sources/adapters";
import { parsePublicIndexResults, recoverFromPublicIndex, type PublicIndexOutcome, type PublicIndexParse, type IndexedPost } from "./sources/publicIndex";

export type InstagramPost = IndexedPost;
export type InstagramIndexParse = PublicIndexParse;
export type InstagramRecoveryOutcome = PublicIndexOutcome;

export const instagramHandleFromUrl = (url: string) => instagramAdapter.handleFromUrl(url);
export const resultBelongsToHandle = (r: DiscoveryResult, handle: string) => instagramAdapter.resultBelongsToHandle(r, handle);
export const parseInstagramIndexResults = (handle: string, results: DiscoveryResult[]) => parsePublicIndexResults(instagramAdapter, handle, results);
export const recoverInstagramFromPublicIndex = (seedUrl: string, providerOverride?: DiscoveryProvider | null) => recoverFromPublicIndex(seedUrl, instagramAdapter, providerOverride);
