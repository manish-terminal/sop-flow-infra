import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { createGoFunction } from './go-function';

export interface StorageStackProps extends cdk.StackProps {
  coreTable: dynamodb.ITable;
}

export class StorageStack extends cdk.Stack {
  public readonly proofsBucket: s3.Bucket;
  public readonly proofLinkFn: cdk.aws_lambda.Function;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // 1. S3 Bucket for task proofs
    this.proofsBucket = new s3.Bucket(this, 'SOPFlowProofsBucket', {
      bucketName: `sopflow-proofs-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'ArchiveProofObjects',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: cdk.aws_s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(180),
            },
          ],
        },
      ],
    });

    // 2. Go Lambda function for S3 trigger (proof-link)
    this.proofLinkFn = createGoFunction(this, 'ProofLinkFunction', {
      entryDir: './cmd/proof-link',
      functionName: 'sopflow-proof-link',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        S3_BUCKET: this.proofsBucket.bucketName,
      },
    });

    // 3. Grant Permissions
    props.coreTable.grantReadWriteData(this.proofLinkFn);
    this.proofsBucket.grantRead(this.proofLinkFn);

    // 4. Grant EventBridge publishing permission directly (avoiding circular dependency)
    this.proofLinkFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [
          `arn:aws:events:${this.region}:${this.account}:event-bus/sopflow-events`,
        ],
      })
    );

    // 5. Add S3 event notification
    this.proofsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.proofLinkFn)
    );
  }
}
