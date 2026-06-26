import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket and event notification configuration will be defined here
  }
}
