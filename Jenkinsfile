/*
 * CI/CD for the Weekly Report Dashboard.
 *
 *   Prepare -> Backend tests -> Build images -> Push to ECR -> Deploy to EC2
 *
 * Runs on the Jenkins EC2 server, which needs only Docker, Git and the AWS CLI: the tests and
 * both builds run inside containers. Full setup in docs/DEPLOYMENT.md.
 *
 * What Jenkins must have configured (docs/DEPLOYMENT.md, step 8):
 *   - Credential "app-ec2-ssh": SSH username (ec2-user) + private key of the app server.
 *   - Global environment variable APP_EC2_HOST: the app server's PRIVATE IP.
 *   - Plugins from the "suggested" set: Pipeline, Git, Credentials Binding, JUnit, Timestamper.
 *
 * No AWS keys anywhere: the Jenkins server's IAM instance role allows pushing to the two ECR
 * repositories, and the AWS CLI picks the role up on its own.
 */

pipeline {
    agent any

    options {
        // Two deploys racing each other would leave the server on whichever finished last.
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 45, unit: 'MINUTES')
        timestamps()
    }

    parameters {
        booleanParam(name: 'RUN_TESTS', defaultValue: true,
                description: 'Run the backend test suite against a throwaway MySQL before building.')
        booleanParam(name: 'DEPLOY', defaultValue: true,
                description: 'Deploy to the app EC2 server after pushing. Untick to only build and push.')
        string(name: 'DEPLOY_EXISTING_TAG', defaultValue: '', trim: true,
                description: 'Rollback / redeploy: an image tag already in ECR (a 12-character commit id). '
                        + 'When set, tests, build and push are skipped and that tag is deployed.')
    }

    environment {
        AWS_REGION    = 'ap-south-1'
        BACKEND_REPO  = 'weekly-report-backend'
        FRONTEND_REPO = 'weekly-report-frontend'
        APP_DIR       = '/opt/weekly-report'
    }

    stages {
        stage('Prepare') {
            steps {
                script {
                    env.REDEPLOY = params.DEPLOY_EXISTING_TAG ? 'true' : 'false'

                    // Images are tagged with the commit they were built from, never "latest":
                    // the tag then says exactly what is running, and a rollback is "deploy
                    // the previous tag" rather than "hope latest was not overwritten".
                    env.IMAGE_TAG = env.REDEPLOY == 'true'
                            ? params.DEPLOY_EXISTING_TAG
                            : sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()

                    // The account id is looked up rather than hardcoded, so this file holds
                    // nothing account-specific.
                    def account = sh(script: 'aws sts get-caller-identity --query Account --output text',
                            returnStdout: true).trim()
                    env.ECR_REGISTRY = "${account}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"

                    if (params.DEPLOY && !env.APP_EC2_HOST) {
                        error('APP_EC2_HOST is not set. Add it under Manage Jenkins -> System -> '
                                + 'Global properties -> Environment variables (docs/DEPLOYMENT.md, step 8).')
                    }

                    currentBuild.description = env.REDEPLOY == 'true'
                            ? "redeploy ${env.IMAGE_TAG}"
                            : env.IMAGE_TAG
                }
            }
        }

        stage('Backend tests') {
            when {
                allOf {
                    expression { params.RUN_TESTS }
                    expression { env.REDEPLOY == 'false' }
                }
            }
            steps {
                sh 'bash ci/backend-tests.sh'
            }
            post {
                always {
                    // Shows per-test results on the build page, and the trend across builds.
                    junit allowEmptyResults: true, testResults: 'ci-reports/surefire-reports/*.xml'
                }
            }
        }

        stage('Build images') {
            when { expression { env.REDEPLOY == 'false' } }
            steps {
                // The frontend build also runs the linter and the TypeScript check - see
                // frontend/Dockerfile - so a lint warning fails the pipeline here.
                sh '''
                    docker build -t "$ECR_REGISTRY/$BACKEND_REPO:$IMAGE_TAG" backend/weekly-report-backend
                    docker build -t "$ECR_REGISTRY/$FRONTEND_REPO:$IMAGE_TAG" frontend
                '''
            }
        }

        stage('Push to ECR') {
            when { expression { env.REDEPLOY == 'false' } }
            steps {
                // The login token comes from the instance role and is valid for 12 hours.
                sh '''
                    aws ecr get-login-password --region "$AWS_REGION" \
                        | docker login --username AWS --password-stdin "$ECR_REGISTRY"
                    docker push "$ECR_REGISTRY/$BACKEND_REPO:$IMAGE_TAG"
                    docker push "$ECR_REGISTRY/$FRONTEND_REPO:$IMAGE_TAG"
                '''
            }
        }

        stage('Deploy to EC2') {
            when { expression { params.DEPLOY } }
            steps {
                // The key is written to a temporary file for this block only and deleted
                // afterwards. Single-quoted shell, so the shell - not Groovy - expands the
                // variables and the key path never appears in the build log.
                withCredentials([sshUserPrivateKey(credentialsId: 'app-ec2-ssh',
                        keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
                    sh '''
                        SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
                        TARGET="$SSH_USER@$APP_EC2_HOST"

                        scp $SSH_OPTS deploy/docker-compose.prod.yml "$TARGET:$APP_DIR/docker-compose.yml"
                        scp $SSH_OPTS deploy/deploy.sh "$TARGET:$APP_DIR/deploy.sh"
                        ssh $SSH_OPTS "$TARGET" \
                            "bash $APP_DIR/deploy.sh '$ECR_REGISTRY' '$IMAGE_TAG' '$AWS_REGION'"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Done: ${env.IMAGE_TAG}${params.DEPLOY ? ' is live on the app server.' : ' pushed to ECR (not deployed).'}"
        }
        failure {
            echo 'Failed. If the Deploy stage failed, deploy.sh has already put the previous release back.'
        }
        always {
            // Keep the Jenkins server's disk in check. Images from the last week stay, as the
            // layer cache that makes the next build fast.
            sh 'docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true'
        }
    }
}
