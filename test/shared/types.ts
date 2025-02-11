import type { IMultiHash } from "./multihash";

export interface MockIpfs extends IMultiHash {
  multiHash: string;
}
