import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

interface GlobalIndex {
  indexName: string;
  partitionKeyName: string;
  partitionKeyType?: dynamodb.AttributeType;
  sortKeyName?: string;
  sortKeyType?: dynamodb.AttributeType;
}

export interface DynamoTableProps {
  id: string;
  partitionKey: string;
  sortKey?: string;
  globalIndexes?: GlobalIndex[];
}
