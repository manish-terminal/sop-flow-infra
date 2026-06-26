import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class TablesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB tables configuration will be defined here
  }
}
