import { defineRailway, project, service, postgres, redis, github } from "railway/iac";

// Your Railway public domains — update these if services are recreated
const BACKEND_DOMAIN = "backend-production-9e73.up.railway.app";
const FRONTEND_DOMAIN = "frontend-production-8808.up.railway.app";

export default defineRailway(() => {
  const db = postgres("database");
  const cache = redis("cache");

  const backend = service("backend", {
    source: github("Qualixe/topten-customer-platfrom", { branch: "master", rootDirectory: "backend" }),
    start: "bash start.sh",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      APP_ENV: "production",
      SECRET_KEY: "change-me-set-in-dashboard",
      // Allow requests from the frontend domain
      CORS_ORIGINS: `https://${FRONTEND_DOMAIN}`,
      FRONTEND_BASE_URL: `https://${FRONTEND_DOMAIN}`,
      // Bootstrap admin — change these in the Railway dashboard after first deploy
      INITIAL_ADMIN_EMAIL: "admin@topten.com.bd",
      INITIAL_ADMIN_PASSWORD: "changeme123",
      INITIAL_ADMIN_NAME: "Admin",
    },
  });

  const celeryWorker = service("celery-worker", {
    source: github("Qualixe/topten-customer-platfrom", { branch: "master", rootDirectory: "backend" }),
    start: "bash worker.sh",
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      APP_ENV: "production",
    },
  });

  const frontend = service("frontend", {
    source: github("Qualixe/topten-customer-platfrom", { branch: "master", rootDirectory: "frontend" }),
    env: {
      NODE_ENV: "production",
      // Baked into the Next.js build — must be the real backend URL
      NEXT_PUBLIC_API_BASE_URL: `https://${BACKEND_DOMAIN}/api/v1`,
    },
  });

  return project("topten-customer-platform", {
    resources: [db, cache, backend, celeryWorker, frontend],
  });
});
