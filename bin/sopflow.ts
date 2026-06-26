#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { TablesStack } from '../lib/tables-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { EventsStack } from '../lib/events-stack';

const app = new cdk.App();

// Create Tables Stack first as database dependencies
new TablesStack(app, 'TablesStack', {
  /* env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }, */
});

// Create Storage Stack (S3)
new StorageStack(app, 'StorageStack', {
  /* env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }, */
});

// Create API Stack (Lambdas + API Gateway)
new ApiStack(app, 'ApiStack', {
  /* env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }, */
});

// Create Events Stack (EventBridge)
new EventsStack(app, 'EventsStack', {
  /* env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }, */
});
