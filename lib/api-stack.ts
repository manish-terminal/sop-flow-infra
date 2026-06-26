import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { createGoFunction } from './go-function';

export interface ApiStackProps extends cdk.StackProps {
  coreTable: dynamodb.ITable;
  authTable: dynamodb.ITable;
  notifTable: dynamodb.ITable;
  proofsBucket: s3.IBucket;
}

export class ApiStack extends cdk.Stack {
  public readonly apiFn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // JWT secret loaded from env (fallback to development value)
    const jwtSecret = process.env.JWT_SECRET || 'default-dev-secret-change-me-in-production';

    // 1. Create Monolithic API Go Lambda
    this.apiFn = createGoFunction(this, 'ApiMonolithFunction', {
      entryDir: './cmd/api',
      functionName: 'sopflow-api',
      timeout: cdk.Duration.seconds(30),
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        AUTH_TABLE_NAME: props.authTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
        S3_BUCKET: props.proofsBucket.bucketName,
        JWT_SECRET: jwtSecret,
      },
    });

    // 2. Grant DynamoDB and S3 Permissions
    props.coreTable.grantReadWriteData(this.apiFn);
    props.authTable.grantReadWriteData(this.apiFn);
    props.notifTable.grantReadWriteData(this.apiFn);
    props.proofsBucket.grantReadWrite(this.apiFn); // Needs upload/presign PUT and timeline/GET permissions

    // 3. Create REST API Gateway
    const api = new apigateway.RestApi(this, 'SOPFlowRestApi', {
      restApiName: 'SOPFlow API Gateway',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // 4. Wildcard Proxy Integrations
    const lambdaIntegration = new apigateway.LambdaIntegration(this.apiFn);
    
    // Catch-all for root path
    api.root.addMethod('ANY', lambdaIntegration);

    // Catch-all for sub-paths
    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration);
  }
}
