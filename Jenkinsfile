@Library('Shared') _

pipeline {
    agent any

    environment {
        GIT_URL = 'https://github.com/syedmehfooz47/hrms-devops.git'
        GIT_BRANCH = 'main'
        DOCKER_HUB_USER = 'syedmehfooz'
        SONAR_API = 'Sonar'
        SONAR_PROJECT = 'hrms-devops'
        SONAR_KEY = 'hrms-devops'
        SONAR_HOME = tool 'Sonar'
        DOCKER_TAG = "v1.${env.BUILD_NUMBER}"
    }

    stages {


        stage('Clean Workspace') {
            steps {
                clean_ws()
            }
        }
        stage('Checkout Code') {
            steps {
                code_checkout(env.GIT_URL, env.GIT_BRANCH)
            }
        }

        stage('Check Skip CI') {
            steps {
                script {
                    def commitMsg = sh(script: "git log -1 --pretty=%B", returnStdout: true).trim()
                    if (commitMsg.contains('[skip ci]')) {
                        currentBuild.result = 'SUCCESS'
                        error("Skipping build due to [skip ci] in commit message")
                    }
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    withEnv(["PATH+NODE=${WORKSPACE}/node_bin/bin"]) {
                        echo "Running Backend Tests..."
                        dir('backend') {
                            sh 'npm install'
                            sh 'npm test'
                        }
                        echo "Running Frontend Tests..."
                        dir('.') {
                            sh 'npm install'
                            sh 'npm run test'
                        }
                    }
                }
            }
        }

        stage('Trivy File System Scan') {
            steps {
                trivy_scan()
            }
        }

        stage('OWASP Dependency Check') {
            steps {
                echo "Skip"
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    sh '''
                        if ! command -v node &> /dev/null; then
                            ARCH=$(uname -m)
                            if [ "$ARCH" = "aarch64" ]; then
                                NODE_URL="https://nodejs.org/dist/v20.14.0/node-v20.14.0-linux-arm64.tar.xz"
                                NODE_DIR="node-v20.14.0-linux-arm64"
                            else
                                NODE_URL="https://nodejs.org/dist/v20.14.0/node-v20.14.0-linux-x64.tar.xz"
                                NODE_DIR="node-v20.14.0-linux-x64"
                            fi
                            if [ ! -d "node_bin" ]; then
                                echo "Downloading Node.js..."
                                curl -sL $NODE_URL | tar -xJ
                                mv $NODE_DIR node_bin
                            fi
                        else
                            mkdir -p node_bin/bin
                            ln -sfn $(which node) node_bin/bin/node
                        fi
                    '''
                }
                withEnv(["PATH+NODE=${WORKSPACE}/node_bin/bin"]) {
                    sonarqube_analysis(env.SONAR_API, env.SONAR_PROJECT, env.SONAR_KEY)
                }
            }
        }

        stage('Quality Gate') {
            steps {
                sonarqube_code_quality()
            }
        }




        stage("Docker: Build Images"){
            steps{
                script{
                        dir('backend'){
                            docker_build("hrms-backend","${env.DOCKER_TAG}","${env.DOCKER_HUB_USER}")
                        }
                    
                        dir('.') {
                            docker_build("hrms-frontend","${env.DOCKER_TAG}","${env.DOCKER_HUB_USER}")
                        }
                }
            }
        }
                stage("Docker: Push to DockerHub"){
            steps{
                script{
                    docker_push("hrms-backend","${env.DOCKER_TAG}","${env.DOCKER_HUB_USER}") 
                    docker_push("hrms-frontend","${env.DOCKER_TAG}","${env.DOCKER_HUB_USER}")
                }
            }
        }

        stage('Docker Cleanup') {
            steps {
                script{
                    docker_cleanup('hrms-frontend', "${env.DOCKER_TAG}", "${env.DOCKER_HUB_USER}")
                    docker_cleanup('hrms-backend', "${env.DOCKER_TAG}", "${env.DOCKER_HUB_USER}")
                }
            }
        }
    }

    post {
        always {
            generate_reports(projectName: 'HRMS-DevOps', imageName: 'hrms-frontend, hrms-backend', imageTag: "${env.DOCKER_TAG},${env.DOCKER_TAG}")
        }
        success {
            script {
                if (fileExists('dependency-check-report.xml')) {
                    archiveArtifacts(
                        artifacts: 'dependency-check-report.xml',
                        followSymlinks: false
                    )
                } else {
                    echo "Dependency Check report not found. Continuing pipeline..."
                }
            }
            build job: "HRMS-CD", parameters: [
                string(name: 'DOCKER_TAG', value: "${env.DOCKER_TAG}")
            ]
            script {
                emailext attachLog: true,
                attachmentsPattern: 'reports/build-report.txt',
                from: 'jenkins@alerts.syedmehfooz.com',
                subject: "HRMS Application CI build successful - '${currentBuild.result}'",
                body: """
                    <html>
                    <body>
                        <div style="background-color: #FFA07A; padding: 10px; margin-bottom: 10px;">
                            <p style="color: black; font-weight: bold;">Project: ${env.JOB_NAME}</p>
                        </div>
                        <div style="background-color: #90EE90; padding: 10px; margin-bottom: 10px;">
                            <p style="color: black; font-weight: bold;">Build Number: ${env.BUILD_NUMBER}</p>
                        </div>
                        <div style="background-color: #87CEEB; padding: 10px; margin-bottom: 10px;">
                            <p style="color: black; font-weight: bold;">URL: ${env.BUILD_URL}</p>
                        </div>
                    </body>
                    </html>
            """,
            to: 'hello@syedmehfooz.com',
            mimeType: 'text/html'
            }
        }
        failure {
            script {
                emailext attachLog: true,
                attachmentsPattern: 'reports/build-report.txt',
                from: 'jenkins@alerts.syedmehfooz.com',
                subject: "HRMS Application CI build failed - '${currentBuild.result}'",
                body: """
                    <html>
                    <body>
                        <div style="background-color: #FFA07A; padding: 10px; margin-bottom: 10px;">
                            <p style="color: black; font-weight: bold;">Project: ${env.JOB_NAME}</p>
                        </div>
                        <div style="background-color: #90EE90; padding: 10px; margin-bottom: 10px;">
                            <p style="color: black; font-weight: bold;">Build Number: ${env.BUILD_NUMBER}</p>
                        </div>
                    </body>
                    </html>
            """,
            to: 'hello@syedmehfooz.com',
            mimeType: 'text/html'
            }
        }
    }
}