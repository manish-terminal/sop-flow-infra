#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TablesStack } from '../lib/tables-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { EventsStack } from '../lib/events-stack';

const app = new cdk.App();

// 1. Create Tables Stack (Database Layers)
const tablesStack = new TablesStack(app, 'TablesStack');

// 2. Create Storage Stack (S3 and S3 triggers)
const storageStack = new StorageStack(app, 'StorageStack', {
  coreTable: tablesStack.coreTable,
});

// 3. Create API Stack (Monolithic API + API Gateway REST proxy)
const apiStack = new ApiStack(app, 'ApiStack', {
  coreTable: tablesStack.coreTable,
  authTable: tablesStack.authTable,
  notifTable: tablesStack.notifTable,
  proofsBucket: storageStack.proofsBucket,
});

// 4. Create Events Stack (EventBridge Bus, Rules, Schedulers, and Event Lambdas)
new EventsStack(app, 'EventsStack', {
  coreTable: tablesStack.coreTable,
  notifTable: tablesStack.notifTable,
  apiFn: apiStack.apiFn,
});
