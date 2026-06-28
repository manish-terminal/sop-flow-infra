import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { GoFunction } from './go-function';

export interface ApiStackProps extends cdk.StackProps {
  coreTable: dynamodb.ITable;
  authTable: dynamodb.ITable;
  notifTable: dynamodb.ITable;
  proofsBucket: s3.IBucket;
  eventBus: events.IEventBus;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Retrieve JWT secret from SSM Parameter Store (SSM Parameter /sopflow/jwt-secret)
    const jwtSecret = ssm.StringParameter.valueForStringParameter(this, '/sopflow/jwt-secret');

    // Monolithic API Lambda function
    const apiLambda = new GoFunction(this, 'ApiLambda', {
      entry: 'cmd/api',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        AUTH_TABLE_NAME: props.authTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
        S3_BUCKET: props.proofsBucket.bucketName,
        EVENT_BUS_NAME: props.eventBus.eventBusName,
        JWT_SECRET: jwtSecret,
        TWILIO_ACCOUNT_SID: 'ACmock',
        TWILIO_AUTH_TOKEN: 'mocktoken',
        TWILIO_PHONE_NUMBER: '+15005550006',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    // Grant Table read/write access to monolithic API Lambda
    props.coreTable.grantReadWriteData(apiLambda);
    props.authTable.grantReadWriteData(apiLambda);
    props.notifTable.grantReadWriteData(apiLambda);
    props.proofsBucket.grantReadWrite(apiLambda);
    props.eventBus.grantPutEventsTo(apiLambda);

    // Create API Gateway REST API with proxy routing
    const api = new apigateway.RestApi(this, 'SopFlowApi', {
      restApiName: 'SopFlow API Gateway',
      description: 'API Gateway for SOPFlow Monolithic Routing',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    const integration = new apigateway.LambdaIntegration(apiLambda);

    // Any /{proxy+} goes to monolithic Lambda
    const proxy = api.root.addResource('{proxy+}');
    proxy.addMethod('ANY', integration);

    // Root path '/' goes to monolithic Lambda
    api.root.addMethod('ANY', integration);
  }
}
