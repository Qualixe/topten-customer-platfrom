import { defineRailway, project, service, postgres, redis } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("database");
  const cache = redis("cache");

  const backend = service("backend", {
    source: {
      repo: ".",
      rootDirectory: "backend",
    },
    build: "pip install -r requirements.txt",
    start: "bash start.sh",
    env: {
      DATABASE_URL: db.databaseUrl,
      REDIS_URL: cache.redisUrl,
      APP_ENV: "production",
      // Set SECRET_KEY manually in the Railway dashboard — do not hardcode
      CORS_ORIGINS: "https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}",
      FRONTEND_BASE_URL: "https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}",
      UPLOAD_DIR: "/app/var/uploads/imports",
      BRANDING_UPLOAD_DIR: "/app/var/public/branding",
      GIFT_IMAGE_UPLOAD_DIR: "/app/var/public/gift-images",
    },
  });

  const celeryWorker = service("celery-worker", {
    source: {
      repo: ".",
      rootDirectory: "backend",
    },
    build: "pip install -r requirements.txt",
    start: "bash worker.sh",
    env: {
      DATABASE_URL: db.databaseUrl,
      REDIS_URL: cache.redisUrl,
      APP_ENV: "production",
      UPLOAD_DIR: "/app/var/uploads/imports",
      BRANDING_UPLOAD_DIR: "/app/var/public/branding",
      GIFT_IMAGE_UPLOAD_DIR: "/app/var/public/gift-images",
    },
  });

  const frontend = service("frontend", {
    source: {
      repo: ".",
      rootDirectory: "frontend",
    },
    build: "npm ci && npm run build",
    start: "npm start",
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_API_BASE_URL: "https://${{ backend.RAILWAY_PUBLIC_DOMAIN }}/api/v1",
    },
  });

  return project("topten-customer-platform", {
    resources: [db, cache, backend, celeryWorker, frontend],
  });
});
