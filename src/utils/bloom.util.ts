import murmurhash from "murmurhash";
import BitSet from "bitset";
import { serverConfig } from "../config";

const { HASH_SIZE, BLOOM_FILTER_SIZE } = serverConfig;

export const addToBloomFilter = (filter: string, item: number): string => {
  let bitset = new BitSet(filter);
  if (bitset.cardinality() >= BLOOM_FILTER_SIZE) {
    bitset = new BitSet();
  }
  for (let i = 0; i < HASH_SIZE; i++) {
    const index = murmurhash.v3(String(item), i) % BLOOM_FILTER_SIZE;
    bitset.set(index);
  }
  return bitset.toString();
};

export const existsInBloomFilter = (filter: string, item: number): boolean => {
  const bitset = new BitSet(filter);
  for (let i = 0; i < HASH_SIZE; i++) {
    const index = murmurhash.v3(String(item), i) % BLOOM_FILTER_SIZE;
    if (!bitset.get(index)) return false;
  }
  return true;
};
