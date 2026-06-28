import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { GoFunction } from './go-function';

export interface EventsStackProps extends cdk.StackProps {
  coreTable: dynamodb.ITable;
  notifTable: dynamodb.ITable;
  eventBus: events.IEventBus;
}

export class EventsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    // 1. Health Score Lambda
    const healthScoreLambda = new GoFunction(this, 'HealthScoreLambda', {
      entry: 'cmd/health-score',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    props.coreTable.grantReadWriteData(healthScoreLambda);

    // 2. Notification Dispatch Lambda
    const notificationDispatchLambda = new GoFunction(this, 'NotificationDispatchLambda', {
      entry: 'cmd/notification-dispatch',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    props.notifTable.grantReadWriteData(notificationDispatchLambda);

    // 3. Routing Rules on the shared EventBus
    const taskEventsRule = new events.Rule(this, 'TaskEventsRule', {
      eventBus: props.eventBus,
      eventPattern: {
        source: ['sopflow.tasks'],
        detailType: ['TaskCompleted', 'TaskMissed'],
      },
    });

    taskEventsRule.addTarget(new targets.LambdaFunction(healthScoreLambda));
    taskEventsRule.addTarget(new targets.LambdaFunction(notificationDispatchLambda));
  }
}

