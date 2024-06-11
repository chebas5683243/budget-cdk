import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { FunctionUrl, FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { DynamoTableProps } from "../types/dynamo";

export class BudgetTrackerStack extends cdk.Stack {
  private readonly stackPreffix = "Budget";

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const deploymentBucket = this.createCustomeS3Bucket();
    const budgetLambda = this.createCustomLambda(deploymentBucket);
    this.createDynamoDbTables(budgetLambda);
  }

  private createCustomeS3Bucket() {
    const s3 = cdk.aws_s3;

    const bucketName = (this.stackPreffix + "-lambda-bucket").toLowerCase();

    const bucket = new s3.Bucket(this, this.stackPreffix.concat("Bucket"), {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketName,
    });

    return bucket;
  }

  private createCustomLambda(deploymentBucket: cdk.aws_s3.Bucket) {
    const lambda = cdk.aws_lambda;

    const functionName = this.stackPreffix.concat("Lambda");
    const S3ObjectPath = "dist.zip";
    const handlerPath = "dist/handlers/index.lambdaHandler";

    const lambdaFn = new lambda.Function(this, functionName, {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName,
      code: lambda.Code.fromBucket(deploymentBucket, S3ObjectPath),
      handler: handlerPath,
    });

    const functionUrlName = this.stackPreffix.concat("LambdaUrl");

    const lambdaUrl = new FunctionUrl(this, functionUrlName, {
      function: lambdaFn,
      authType: FunctionUrlAuthType.NONE,
    });

    new cdk.CfnOutput(this, "LambdaFunctionUrl", {
      value: lambdaUrl.url,
      description: "The URL of the Lambda Function",
    });

    return lambdaFn;
  }

  private createDynamoDbTables(lambda: cdk.aws_lambda.Function) {
    this.createCustomDynamoTable({
      id: "Transactions",
      partitionKey: "userId",
      sortKey: "id",
      lambda,
    });

    this.createCustomDynamoTable({
      id: "Categories",
      partitionKey: "userId",
      sortKey: "id",
      lambda,
    });

    this.createCustomDynamoTable({
      id: "Settings",
      partitionKey: "userId",
      sortKey: "id",
      lambda,
    });
  }

  private createCustomDynamoTable(tableProps: DynamoTableProps) {
    const dynamodb = cdk.aws_dynamodb;

    const customTable = new dynamodb.Table(this, tableProps.id, {
      partitionKey: {
        name: tableProps.partitionKey,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: tableProps.sortKey
        ? { name: tableProps.sortKey, type: dynamodb.AttributeType.STRING }
        : undefined,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: tableProps.id,
    });

    if (tableProps.globalIndexes) {
      tableProps.globalIndexes.forEach((index) => {
        customTable.addGlobalSecondaryIndex({
          indexName: index.indexName,
          partitionKey: {
            name: index.partitionKey,
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: index.sortKey
            ? { name: index.sortKey, type: dynamodb.AttributeType.STRING }
            : undefined,
        });
      });
    }

    customTable.grantReadWriteData(tableProps.lambda);
  }
}
