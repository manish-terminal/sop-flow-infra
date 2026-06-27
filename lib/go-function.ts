import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { execSync } from 'child_process';

export interface GoFunctionProps extends Omit<lambda.FunctionProps, 'code' | 'runtime' | 'handler'> {
  entry: string; // Directory under backend, e.g. 'cmd/api'
}

export class GoFunction extends lambda.Function {
  constructor(scope: any, id: string, props: GoFunctionProps) {
    const entryDir = path.join(__dirname, '../../backend', props.entry);
    const backendDir = path.join(__dirname, '../../backend');

    super(scope, id, {
      ...props,
      runtime: lambda.Runtime.PROVIDED_AL2023,
      handler: 'bootstrap',
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(backendDir, {
        bundling: {
          image: cdk.DockerImage.fromRegistry('public.ecr.aws/sam/build-go1.x:latest'),
          command: [
            'bash', '-c',
            `GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -ldflags="-s -w" -o /asset-output/bootstrap ./${props.entry}`
          ],
          local: {
            tryBundle(outputDir: string) {
              try {
                // Check if Go is installed locally
                execSync('go version', { stdio: 'ignore' });
                // Fast local compilation
                execSync(
                  `GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -ldflags="-s -w" -o ${path.join(outputDir, 'bootstrap')} ./${props.entry}`,
                  { cwd: backendDir, stdio: 'inherit' }
                );
                return true;
              } catch (e) {
                console.warn('Local Go compilation failed, falling back to Docker container bundling:', e);
                return false;
              }
            }
          }
        }
      })
    });
  }
}
