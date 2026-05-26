npx ts-node-dev --transpile-only --exit-child scripts/clear-db.ts

docker run -d --name payroll-redis -p 6379:6379 redis:7-alpine

docker start payroll-redis

//verification succeded
docker exec payroll-redis redis-cli ping
