import * as cdk from "aws-cdk-lib";

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
  lambda: cdk.aws_lambda.Function;
}
