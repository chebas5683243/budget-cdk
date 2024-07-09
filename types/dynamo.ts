interface GlobalIndex {
  indexName: string;
  partitionKey: string;
  sortKey?: string;
}

export interface DynamoTableProps {
  id: string;
  partitionKey: string;
  sortKey?: string;
  globalIndexes?: GlobalIndex[];
}
