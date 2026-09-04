pipeline {
    agent any

    environment {
        BACKEND_IMAGE_NAME  = 'deepan45/payslip-backend'
        FRONTEND_IMAGE_NAME = 'deepan45/payslip-frontend'

        BACKEND_CONTAINER   = 'payslip-backend'
        FRONTEND_CONTAINER  = 'payslip-frontend'
        DB_CONTAINER        = 'payslip-db'

        GITHUB_REPO         = 'https://github.com/Deepan45/payslip.git'

        DB_HOST             = 'payslip-db'
        DB_PORT             = '5432'
        DB_NAME             = 'payslip'
        DB_USER             = 'payslip'
        DB_PASS             = 'ChangeThisDbPassword2026'

        JWT_SECRET          = 'ChangeThisToALongRandomSecret2026'
        SEED_ADMIN_EMAIL    = 'admin@example.com'
        SEED_ADMIN_PASSWORD = 'ChangeMe123!'

        FRONTEND_PORT       = '8080'
        BACKEND_PORT        = '4000'

        // Public address the app is actually reached at (browser origin).
        // Override with the server's IP/domain — CORS_ORIGIN below is built
        // from this, and the backend only auto-allows localhost/127.0.0.1.
        PUBLIC_HOST         = '93.127.194.128'

        DOCKER_NETWORK      = 'payslip-network'
    }

    triggers {
        githubPush()
    }

    stages {

        stage('Checkout') {
            steps {
                git(
                    branch: 'main',
                    url: "${GITHUB_REPO}",
                    credentialsId: 'github'
                )
            }
        }

        stage('Build Backend Image') {
            steps {
                sh """
                    docker build \
                      -t ${BACKEND_IMAGE_NAME}:latest \
                      -f backend/Dockerfile backend
                """
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh """
                    docker build \
                      --build-arg VITE_API_URL=/api \
                      -t ${FRONTEND_IMAGE_NAME}:latest \
                      -f frontend/Dockerfile frontend
                """
            }
        }

        stage('Create Docker Network') {
            steps {
                sh """
                    docker network inspect ${DOCKER_NETWORK} >/dev/null 2>&1 || \
                    docker network create ${DOCKER_NETWORK}
                """
            }
        }

        stage('Ensure Postgres Container') {
            // Never rebuilt/removed by this pipeline — DB_CONTAINER keeps its
            // data volume across every redeploy. Only created once.
            steps {
                sh """
                    if [ "\$(docker inspect -f '{{.State.Running}}' ${DB_CONTAINER} 2>/dev/null)" = "true" ]; then
                        echo "Postgres already running"
                    elif docker inspect ${DB_CONTAINER} >/dev/null 2>&1; then
                        echo "Starting existing Postgres container"
                        docker start ${DB_CONTAINER}
                    else
                        echo "Creating Postgres container"
                        docker run -d \
                          --name ${DB_CONTAINER} \
                          --network ${DOCKER_NETWORK} \
                          --restart unless-stopped \
                          -e POSTGRES_USER=${DB_USER} \
                          -e POSTGRES_PASSWORD=${DB_PASS} \
                          -e POSTGRES_DB=${DB_NAME} \
                          -v payslip-db-data:/var/lib/postgresql/data \
                          postgres:16-alpine
                    fi
                """
            }
        }

        stage('Remove Old Containers') {
            steps {
                sh """
                    docker stop ${BACKEND_CONTAINER} || true
                    docker rm ${BACKEND_CONTAINER} || true

                    docker stop ${FRONTEND_CONTAINER} || true
                    docker rm ${FRONTEND_CONTAINER} || true
                """
            }
        }

        stage('Run Backend Container') {
            steps {
                sh """
                    docker run -d \
                      --name ${BACKEND_CONTAINER} \
                      --network ${DOCKER_NETWORK} \
                      --network-alias backend \
                      --restart unless-stopped \
                      -p ${BACKEND_PORT}:4000 \
                      -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public" \
                      -e JWT_SECRET="${JWT_SECRET}" \
                      -e JWT_EXPIRES_IN="8h" \
                      -e PORT=4000 \
                      -e CORS_ORIGIN="*" \
                      -e PUBLIC_BASE_URL="http://${PUBLIC_HOST}:${FRONTEND_PORT}" \
                      -e SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL}" \
                      -e SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD}" \
                      -e COMPANY_NAME="Your Company Pvt Ltd" \
                      -e COMPANY_ADDRESS="123 Business Street, City, Country" \
                      -v payslip-backend-storage:/app/storage \
                      ${BACKEND_IMAGE_NAME}:latest
                """
            }
        }

        stage('Run Frontend Container') {
            // nginx.conf proxies /api to http://backend:4000/ — the
            // --network-alias above is what makes "backend" resolve here.
            steps {
                sh """
                    docker run -d \
                      --name ${FRONTEND_CONTAINER} \
                      --network ${DOCKER_NETWORK} \
                      --restart unless-stopped \
                      -p ${FRONTEND_PORT}:80 \
                      ${FRONTEND_IMAGE_NAME}:latest
                """
            }
        }

        stage('Seed Admin') {
            // Idempotent (backend/src/seed.ts skips if the admin already
            // exists) — safe to run on every deploy.
            steps {
                sh """
                    sleep 10
                    docker exec ${BACKEND_CONTAINER} node dist/seed.js
                """
            }
        }

        stage('Verify Deployment') {
            steps {
                sh """
                    sleep 5
                    docker ps | grep ${DB_CONTAINER}
                    docker ps | grep ${BACKEND_CONTAINER}
                    docker ps | grep ${FRONTEND_CONTAINER}
                    docker logs --tail 50 ${BACKEND_CONTAINER}
                """
            }
        }
    }

    post {
        success {
            echo "✅ Payslip deployed successfully on port ${FRONTEND_PORT}"
        }

        failure {
            echo '❌ Deployment failed. Check Jenkins console logs.'

            sh """
                docker logs --tail 100 ${BACKEND_CONTAINER} || true
                docker logs --tail 100 ${FRONTEND_CONTAINER} || true
            """
        }

        always {
            cleanWs()
        }
    }
}
