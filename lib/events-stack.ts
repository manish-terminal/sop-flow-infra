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

    // 4. Task Generator Lambda & Schedule
    const taskGeneratorLambda = new GoFunction(this, 'TaskGeneratorLambda', {
      entry: 'cmd/task-generator',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    props.coreTable.grantReadWriteData(taskGeneratorLambda);

    const taskGeneratorRule = new events.Rule(this, 'TaskGeneratorRule', {
      schedule: events.Schedule.cron({ minute: '0' }),
    });
    taskGeneratorRule.addTarget(new targets.LambdaFunction(taskGeneratorLambda));

    // 5. Task Sweeper Lambda & Schedule
    const taskSweeperLambda = new GoFunction(this, 'TaskSweeperLambda', {
      entry: 'cmd/task-sweeper',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
        EVENT_BUS_NAME: props.eventBus.eventBusName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    props.coreTable.grantReadWriteData(taskSweeperLambda);
    props.eventBus.grantPutEventsTo(taskSweeperLambda);

    const taskSweeperRule = new events.Rule(this, 'TaskSweeperRule', {
      schedule: events.Schedule.cron({ minute: '0' }),
    });
    taskSweeperRule.addTarget(new targets.LambdaFunction(taskSweeperLambda));

    // 6. Daily Summary Lambda & Schedule
    const dailySummaryLambda = new GoFunction(this, 'DailySummaryLambda', {
      entry: 'cmd/daily-summary',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    props.coreTable.grantReadWriteData(dailySummaryLambda);
    props.notifTable.grantReadWriteData(dailySummaryLambda);

    const dailySummaryRule = new events.Rule(this, 'DailySummaryRule', {
      schedule: events.Schedule.cron({ minute: '0' }),
    });
    dailySummaryRule.addTarget(new targets.LambdaFunction(dailySummaryLambda));
  }
}

