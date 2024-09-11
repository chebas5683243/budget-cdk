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
  private tokenAuthorizer: apigateway.TokenAuthorizer;
  private customApigateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.customLambda = this.createCustomLambda();

    this.tokenAuthorizer = this.createTokenAuthorizer();

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
      },
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

  private createTokenAuthorizer() {
    return new apigateway.TokenAuthorizer(this, "lambdaAuthorizer", {
      handler: this.customLambda,
      authorizerName: "lambdaAuthorizer",
    });
  }

  private createDynamoDbTables() {
    this.createCustomDynamoTable({
      id: "Transactions",
      partitionKey: "userId",
      sortKey: "id",
      globalIndexes: [
        {
          indexName: "userId-transactionDate",
          partitionKeyName: "userId",
          partitionKeyType: dynamodb.AttributeType.STRING,
          sortKeyName: "transactionDate",
          sortKeyType: dynamodb.AttributeType.NUMBER,
        },
        {
          indexName: "userId-categoryId",
          partitionKeyName: "userId",
          partitionKeyType: dynamodb.AttributeType.STRING,
          sortKeyName: "categoryId",
          sortKeyType: dynamodb.AttributeType.STRING,
        },
      ],
    });

    this.createCustomDynamoTable({
      id: "Categories",
      partitionKey: "userId",
      sortKey: "id",
    });

    this.createCustomDynamoTable({
      id: "Settings",
      partitionKey: "userId",
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
            name: index.partitionKeyName,
            type: index.partitionKeyType || dynamodb.AttributeType.STRING,
          },
          sortKey: index.sortKeyName
            ? {
                name: index.sortKeyName,
                type: index.sortKeyType || dynamodb.AttributeType.STRING,
              }
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
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
  }

  private addPublicMethod(resource: apigateway.IResource, httpMethod: string) {
    resource.addMethod(httpMethod, undefined, {
      authorizer: undefined,
    });
  }

  private addProtectedMethod(
    resource: apigateway.IResource,
    httpMethod: string
  ) {
    resource.addMethod(httpMethod, undefined, {
      authorizer: this.tokenAuthorizer,
    });
  }

  private createApiGatewayResources() {
    const rootResource = this.customApigateway.root;
    this.addProtectedMethod(rootResource, "GET");

    const settingsResource = rootResource.addResource("settings");
    this.addProtectedMethod(settingsResource, "GET");
    this.addProtectedMethod(settingsResource, "PATCH");

    // /categories
    const categoriesResource = rootResource.addResource("categories");
    this.addProtectedMethod(categoriesResource, "GET");
    this.addProtectedMethod(categoriesResource, "POST");

    // /categories/{categoryId}
    const categoryResource = categoriesResource.addResource("{categoryId}");
    this.addProtectedMethod(categoryResource, "PATCH");
    this.addProtectedMethod(categoryResource, "DELETE");

    // /transactions
    const transactionsResource = rootResource.addResource("transactions");
    this.addProtectedMethod(transactionsResource, "GET");
    this.addProtectedMethod(transactionsResource, "POST");

    // /transactions/{transactionId}
    const transactionResource =
      transactionsResource.addResource("{transactionId}");
    this.addProtectedMethod(transactionResource, "PATCH");
    this.addProtectedMethod(transactionResource, "DELETE");

    // /reports
    const reports = rootResource.addResource("reports");

    // /reports/history-periods
    const historyPeriods = reports.addResource("history-periods");
    this.addProtectedMethod(historyPeriods, "GET");

    // /reports/history-data
    const historyData = reports.addResource("history-data");
    this.addProtectedMethod(historyData, "GET");

    // /reports/categories-overview
    const categoriesOverview = reports.addResource("categories-overview");
    this.addProtectedMethod(categoriesOverview, "GET");

    // /webhooks
    const webhooks = rootResource.addResource("webhooks");

    // /webhooks/clerk
    const clerkWebhook = webhooks.addResource("clerk");
    this.addPublicMethod(clerkWebhook, "POST");
  }
}
