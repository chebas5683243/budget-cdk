import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { DynamoTableProps } from "../types/dynamo";

export class BudgetTrackerStack extends cdk.Stack {
  private readonly stackPreffix = "Budget";

  private customLambda: lambda.Function;
  private customApigateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.customLambda = this.createCustomLambda();
    this.createDynamoDbTables();

    this.customApigateway = this.createApiGateway();
    this.createApiGatewayResource();
  }

  private createCustomLambda() {

    const functionName = this.stackPreffix.concat("Lambda");
    const S3ObjectPath = "dist.zip";
    const handlerPath = "dist/handlers/index.lambdaHandler";

    const deploymentBucket = this.createCustomeS3Bucket();

    const lambdaFn = new lambda.Function(this, functionName, {
      runtime: lambda.Runtime.NODEJS_20_X,
      functionName,
      code: lambda.Code.fromBucket(deploymentBucket, S3ObjectPath),
      handler: handlerPath,
    });

    return lambdaFn;
  }

  private createCustomeS3Bucket() {
    const bucketName = (this.stackPreffix + "-lambda-bucket").toLowerCase();

    const bucket = new s3.Bucket(this, this.stackPreffix.concat("Bucket"), {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      bucketName,
    });

    return bucket;
  }

  private createDynamoDbTables() {
    this.createCustomDynamoTable({
      id: "Transactions",
      partitionKey: "userId",
      sortKey: "id",
    });

    this.createCustomDynamoTable({
      id: "Categories",
      partitionKey: "userId",
      sortKey: "id",
    });

    this.createCustomDynamoTable({
      id: "Settings",
      partitionKey: "userId",
      sortKey: "id",
    });
  }

  private createCustomDynamoTable(tableProps: DynamoTableProps) {
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

    customTable.grantReadWriteData(this.customLambda);
  }

  private createApiGateway() {
    return new apigateway.RestApi(this, "BudgetRestApi", {
      restApiName: "BudgetRestApi",
    });
  }

  private createApiGatewayResource() {
    this.customApigateway.root.addProxy({
      anyMethod: true,
      defaultIntegration: new apigateway.LambdaIntegration(this.customLambda),
    })
  }
}
