import { defineRailway, project, service, postgres, redis, github } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("database");
  const cache = redis("cache");

  const backend = service("backend", {
    source: github("Qualixe/topten-customer-platfrom", { rootDirectory: "backend" }),
    start: "bash start.sh",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      APP_ENV: "production",
      // Set SECRET_KEY in the Railway dashboard after first deploy — never hardcode it
      SECRET_KEY: "change-me-set-in-dashboard",
    },
  });

  const celeryWorker = service("celery-worker", {
    source: github("Qualixe/topten-customer-platfrom", { rootDirectory: "backend" }),
    start: "bash worker.sh",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      APP_ENV: "production",
    },
  });

  const frontend = service("frontend", {
    source: github("Qualixe/topten-customer-platfrom", { rootDirectory: "frontend" }),
    start: "npm start",
    env: {
      NODE_ENV: "production",
      // NEXT_PUBLIC_* is baked in at build time — set this manually in the Railway
      // dashboard to https://<your-backend-domain>.up.railway.app/api/v1
      // after the backend service gets its public domain assigned.
      NEXT_PUBLIC_API_BASE_URL: "https://placeholder-update-after-deploy.up.railway.app/api/v1",
    },
  });

  return project("topten-customer-platform", {
    resources: [db, cache, backend, celeryWorker, frontend],
  });
});
