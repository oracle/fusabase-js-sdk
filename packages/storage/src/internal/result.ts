/**
 * Class representing the result of a list operation.
 */
export class ListResult {
  /** Array of items (files/references) in the list. */
  items: any[];
  /** Token for the next page of results, or null if no more pages. */
  nextPageToken: string | null;
  /** Array of prefixes (directories) in the list. */
  prefixes: any[];

  /**
   * Constructs a ListResult.
   * @param data - The data containing items, prefixes, and nextPageToken.
   */
  constructor(data: { items: any[]; prefixes: any[]; nextPageToken: string | null }) {
    this.items = data.items;
    this.prefixes = data.prefixes;
    this.nextPageToken = data.nextPageToken ?? null;
  }
}
