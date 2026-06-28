import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import { GoFunction } from './go-function';

export interface StorageStackProps extends cdk.StackProps {
  coreTable: dynamodb.ITable;
  notifTable: dynamodb.ITable;
}

export class StorageStack extends cdk.Stack {
  public readonly proofsBucket: s3.Bucket;
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.proofsBucket = new s3.Bucket(this, 'SOPFlowProofsBucket', {
      bucketName: `sopflow-proofs-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // 2. Custom EventBus
    this.eventBus = new events.EventBus(this, 'SopFlowEventBus', {
      eventBusName: 'sopflow-events',
    });

    // 3. Proof Link Lambda
    const proofLinkLambda = new GoFunction(this, 'ProofLinkLambda', {
      entry: 'cmd/proof-link',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Grant Table, EventBus, and S3 Bucket access
    props.coreTable.grantReadWriteData(proofLinkLambda);
    this.eventBus.grantPutEventsTo(proofLinkLambda);
    this.proofsBucket.grantRead(proofLinkLambda);

    // 4. Configure S3 Trigger on ProofLink Lambda
    this.proofsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(proofLinkLambda)
    );
  }
}
