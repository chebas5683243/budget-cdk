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
    this.createApiGatewayResources();
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
      environment: {
        SETTINGS_TABLE: "Settings",
        TRANSACTIONS_TABLE: "Transactions",
        CATEGORIES_TABLE: "Categories",
        DEFAULT_USER_ID: "6c8c3b66-ecc4-46af-aa1e-e762dc80b3de"
      }
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
    return new apigateway.LambdaRestApi(this, "BudgetLambdaRestApi", {
      handler: this.customLambda,
      proxy: false,
      restApiName: "BudgetLambdaRestApi",
    });
  }

  private createApiGatewayResources() {
    const rootResource = this.customApigateway.root;
    rootResource.addMethod("GET");

    const settingsResource = rootResource.addResource("settings");
    settingsResource.addMethod("GET");
    settingsResource.addMethod("PATCH");

    // /categories
    const categoriesResource = rootResource.addResource("categories");
    categoriesResource.addMethod("GET");
    categoriesResource.addMethod("POST");
    
    // /categories/{categoryId}
    const categoryResource = categoriesResource.addResource("{categoryId}");
    categoryResource.addMethod("PATCH");
    categoryResource.addMethod("DELETE");

    // /transactions
    const transactionsResource = rootResource.addResource("transactions");
    transactionsResource.addMethod("GET");
    transactionsResource.addMethod("POST");

    // /transactions/{transactionId}
    const transactionResource = transactionsResource.addResource("{transactionId}");
    transactionResource.addMethod("PATCH");
    transactionResource.addMethod("DELETE");

    // /reports
    const reports = rootResource.addResource("reports");

    // /reports/history-periods
    const historyPeriods = reports.addResource("history-periods");
    historyPeriods.addMethod("GET");

    // /reports/history-data
    const historyData = reports.addResource("history-data");
    historyData.addMethod("GET");

    // /reports/balance
    const balance = reports.addResource("balance");
    balance.addMethod("GET");

    // /reports/categories-overview
    const categoriesOverview = reports.addResource("categories-overview");
    categoriesOverview.addMethod("GET");
  }
}
