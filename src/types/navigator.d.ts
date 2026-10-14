/** Optional device hints used to decide whether the 3D world should run (not in TypeScript's DOM typings). */
interface AyudhasNetworkInformation {
  readonly saveData?: boolean;
}

interface Navigator {
  readonly connection?: AyudhasNetworkInformation;
  readonly deviceMemory?: number;
}
