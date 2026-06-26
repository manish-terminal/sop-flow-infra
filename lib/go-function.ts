import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { execSync } from 'child_process';

export interface GoFunctionProps {
  entryDir: string;      // Entry directory under backend/ e.g. './cmd/api'
  environment?: Record<string, string>;
  functionName?: string;
  timeout?: cdk.Duration;
  memorySize?: number;
}

export function createGoFunction(
  scope: cdk.Stack,
  id: string,
  props: GoFunctionProps
): lambda.Function {
  return new lambda.Function(scope, id, {
    functionName: props.functionName,
    runtime: lambda.Runtime.PROVIDED_AL2023,
    handler: 'bootstrap',
    architecture: lambda.Architecture.ARM_64,
    environment: props.environment,
    timeout: props.timeout || cdk.Duration.seconds(30),
    memorySize: props.memorySize || 128,
    code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
      bundling: {
        image: cdk.DockerImage.fromRegistry('golang:1.25'),
        local: {
          tryBundle(outputDir: string, options: cdk.BundlingOptions) {
            try {
              // Ensure local go toolchain is available
              execSync('go version', { stdio: 'ignore' });
              // Run build locally
              execSync(
                `GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -ldflags="-s -w" -o ${outputDir}/bootstrap ${props.entryDir}`,
                {
                  cwd: path.join(__dirname, '../../backend'),
                  stdio: 'inherit',
                }
              );
              return true;
            } catch (e) {
              console.warn('Local bundling failed, falling back to Docker container...');
              return false; // Fallback to Docker container
            }
          },
        },
        command: [
          'bash',
          '-c',
          `GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -ldflags="-s -w" -o /asset-output/bootstrap ${props.entryDir}`,
        ],
      },
    }),
  });
}
