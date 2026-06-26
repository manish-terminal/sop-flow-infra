import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { createGoFunction } from './go-function';

export interface EventsStackProps extends cdk.StackProps {
  coreTable: dynamodb.ITable;
  notifTable: dynamodb.ITable;
  apiFn?: lambda.IFunction; // Passed from ApiStack to grant events:PutEvents permission
}

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    // 1. Create EventBridge Event Bus
    this.eventBus = new events.EventBus(this, 'SOPFlowEventBus', {
      eventBusName: 'sopflow-events',
    });

    // Grant events:PutEvents to API Monolith (if passed)
    if (props.apiFn) {
      this.eventBus.grantPutEventsTo(props.apiFn);
    }

    // 2. Define the 5 Event-driven / Scheduled Go Lambdas
    const healthScoreFn = createGoFunction(this, 'HealthScoreFunction', {
      entryDir: './cmd/health-score',
      functionName: 'sopflow-health-score',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
      },
    });

    const notificationDispatchFn = createGoFunction(this, 'NotificationDispatchFunction', {
      entryDir: './cmd/notification-dispatch',
      functionName: 'sopflow-notification-dispatch',
      environment: {
        NOTIF_TABLE_NAME: props.notifTable.tableName,
      },
    });

    const taskGeneratorFn = createGoFunction(this, 'TaskGeneratorFunction', {
      entryDir: './cmd/task-generator',
      functionName: 'sopflow-task-generator',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
      },
    });

    const taskSweeperFn = createGoFunction(this, 'TaskSweeperFunction', {
      entryDir: './cmd/task-sweeper',
      functionName: 'sopflow-task-sweeper',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
    });

    const dailySummaryFn = createGoFunction(this, 'DailySummaryFunction', {
      entryDir: './cmd/daily-summary',
      functionName: 'sopflow-daily-summary',
      environment: {
        CORE_TABLE_NAME: props.coreTable.tableName,
        NOTIF_TABLE_NAME: props.notifTable.tableName,
      },
    });

    // 3. Grant Database and Event Permissions
    props.coreTable.grantReadWriteData(healthScoreFn);
    
    props.notifTable.grantReadWriteData(notificationDispatchFn);
    
    props.coreTable.grantReadWriteData(taskGeneratorFn);
    
    props.coreTable.grantReadWriteData(taskSweeperFn);
    this.eventBus.grantPutEventsTo(taskSweeperFn); // Sweeper emits TaskMissed

    props.coreTable.grantReadData(dailySummaryFn);
    props.notifTable.grantReadWriteData(dailySummaryFn);

    // 4. Configure Event Rules (Targeting event Lambdas)
    // Rule: TaskCompleted -> health-score & notification-dispatch
    const taskCompletedRule = new events.Rule(this, 'TaskCompletedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['sopflow.tasks'],
        detailType: ['TaskCompleted'],
      },
    });
    taskCompletedRule.addTarget(new targets.LambdaFunction(healthScoreFn));
    taskCompletedRule.addTarget(new targets.LambdaFunction(notificationDispatchFn));

    // Rule: TaskMissed -> health-score & notification-dispatch
    const taskMissedRule = new events.Rule(this, 'TaskMissedRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['sopflow.tasks'],
        detailType: ['TaskMissed'],
      },
    });
    taskMissedRule.addTarget(new targets.LambdaFunction(healthScoreFn));
    taskMissedRule.addTarget(new targets.LambdaFunction(notificationDispatchFn));

    // 5. Configure Scheduled Rules (Hourly Schedulers)
    // Scheduler: Hourly Task Generator
    new events.Rule(this, 'HourlyTaskGeneratorRule', {
      schedule: events.Schedule.cron({ minute: '0' }),
      targets: [new targets.LambdaFunction(taskGeneratorFn)],
    });

    // Scheduler: Hourly Task Sweeper
    new events.Rule(this, 'HourlyTaskSweeperRule', {
      schedule: events.Schedule.cron({ minute: '0' }),
      targets: [new targets.LambdaFunction(taskSweeperFn)],
    });

    // Scheduler: Hourly Daily Summary
    new events.Rule(this, 'HourlyDailySummaryRule', {
      schedule: events.Schedule.cron({ minute: '0' }),
      targets: [new targets.LambdaFunction(dailySummaryFn)],
    });
  }
}
