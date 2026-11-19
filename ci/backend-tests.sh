#!/usr/bin/env bash
#
# Runs the backend test suite against a throwaway MySQL 8.4. Called by the Jenkinsfile from
# the repository root.
#
# Everything runs in containers, so the Jenkins server needs Docker and nothing else - no
# JDK, no Maven, no MySQL install. The tests need a real MySQL rather than H2 (the reasons
# are in src/test/resources/application-test.properties), and this gives every build a
# fresh, empty one that is thrown away afterwards.

set -euo pipefail

# Unique per build, so two builds - or a crashed one that left containers behind - can't
# collide.
ID="wrg-ci-${BUILD_NUMBER:-local}-$$"
NETWORK="$ID"
DB="$ID-mysql"
DB_ROOT_PASSWORD="ci-only-root-password"
REPORTS_DIR="$PWD/ci-reports"

cleanup() {
    docker rm -f "$DB" >/dev/null 2>&1 || true
    docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null
docker run -d --name "$DB" --network "$NETWORK" \
    -e MYSQL_ROOT_PASSWORD="$DB_ROOT_PASSWORD" \
    mysql:8.4 >/dev/null

echo "==> Waiting for MySQL"
ready=0
for _ in $(seq 1 60); do
    # Over TCP: during first-time init the image runs a socket-only temporary server, which
    # a socket ping would mistake for the real one.
    if docker exec "$DB" mysqladmin ping -h 127.0.0.1 -uroot -p"$DB_ROOT_PASSWORD" --silent >/dev/null 2>&1; then
        ready=1
        break
    fi
    sleep 2
done
if [[ "$ready" != 1 ]]; then
    echo "!! MySQL did not become ready" >&2
    docker logs --tail 50 "$DB" >&2 || true
    exit 1
fi

rm -rf "$REPORTS_DIR"
mkdir -p "$REPORTS_DIR"

echo "==> Running the backend tests"
# - Sources are mounted read-only and copied inside, so Maven's target/ is written in the
#   container rather than as root-owned files in the Jenkins workspace.
# - SPRING_DATASOURCE_* environment variables outrank application-test.properties, which is
#   how the tests are pointed at this container instead of localhost.
# - The Maven repository is a named volume, so dependencies are downloaded once, not per build.
# - Surefire's reports are copied out and handed back to the Jenkins user for the junit step.
docker run --rm --network "$NETWORK" \
    -v "$PWD/backend/weekly-report-backend:/src:ro" \
    -v "$REPORTS_DIR:/reports" \
    -v wrg-maven-repo:/root/.m2 \
    -e SPRING_DATASOURCE_URL="jdbc:mysql://$DB:3306/weekly_report_dashboard_test?createDatabaseIfNotExist=true&allowPublicKeyRetrieval=true&useSSL=false" \
    -e SPRING_DATASOURCE_USERNAME=root \
    -e SPRING_DATASOURCE_PASSWORD="$DB_ROOT_PASSWORD" \
    -e HOST_UID="$(id -u)" \
    -e HOST_GID="$(id -g)" \
    maven:3.9-eclipse-temurin-21 \
    bash -c 'cp -r /src /build && cd /build
             status=0
             mvn -B test || status=$?
             cp -r target/surefire-reports /reports/ 2>/dev/null || true
             chown -R "$HOST_UID:$HOST_GID" /reports
             exit $status'
