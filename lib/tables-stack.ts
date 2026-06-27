import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class TablesStack extends cdk.Stack {
  public readonly coreTable: dynamodb.Table;
  public readonly authTable: dynamodb.Table;
  public readonly notifTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. SOPFlow-Core Table
    this.coreTable = new dynamodb.Table(this, 'SOPFlowCoreTable', {
      tableName: 'SOPFlow-Core',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Safe for dev sandbox environments
    });

    // GSI-1: EmployeeTasksIndex
    this.coreTable.addGlobalSecondaryIndex({
      indexName: 'EmployeeTasksIndex',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI-2: StatusIndex
    this.coreTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. SOPFlow-Auth Table
    this.authTable = new dynamodb.Table(this, 'SOPFlowAuthTable', {
      tableName: 'SOPFlow-Auth',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 3. SOPFlow-Notifications Table
    this.notifTable = new dynamodb.Table(this, 'SOPFlowNotificationsTable', {
      tableName: 'SOPFlow-Notifications',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
