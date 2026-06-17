const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const localComposePath = path.join(root, "docker-compose.yml");
assert(
  fs.existsSync(localComposePath),
  "docker-compose.yml should exist for local Docker development",
);

const localCompose = read("docker-compose.yml");
assert(
  localCompose.includes("env_file:") && localCompose.includes("- ./.env"),
  "local backend should read environment from root .env",
);
assert(
  localCompose.includes("BACKEND_INTERNAL_URL: http://backend:8000"),
  "local frontend should proxy API requests to backend over the Docker network",
);
assert(
  !/NEXT_PUBLIC_API_URL:\s*http:\/\/localhost:8000/.test(localCompose),
  "local Docker should not force browser calls directly to localhost backend",
);

const prodCompose = read("docker-compose.prod.yml");
for (const required of [
  "postgres:16-alpine",
  "image: caddy:2-alpine",
  "DATABASE_URL: postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}",
  "BACKEND_INTERNAL_URL: http://backend:8000",
  "CORS_ALLOW_ALL: \"false\"",
  "healthcheck:",
]) {
  assert(prodCompose.includes(required), `production compose should include ${required}`);
}
assert(
  /backend:\s*\r?\n(?:.*\r?\n)*?\s+build:\s*\r?\n\s+context: \.\/backend/.test(prodCompose),
  "production backend should build from ./backend",
);
assert(
  /frontend:\s*\r?\n(?:.*\r?\n)*?\s+build:\s*\r?\n\s+context: \.\/frontend/.test(prodCompose),
  "production frontend should build from ./frontend",
);
assert(
  !/ports:\s*\r?\n\s*-\s*"?8000:8000"?/.test(prodCompose),
  "production backend should not publish port 8000",
);
assert(
  !/ports:\s*\r?\n\s*-\s*"?3000:3000"?/.test(prodCompose),
  "production frontend should not publish port 3000",
);

const backendDockerfile = read("backend/Dockerfile");
assert(
  backendDockerfile.includes("requirements.txt"),
  "backend Dockerfile should install from requirements.txt",
);
assert(
  !backendDockerfile.includes("uv.lock"),
  "backend Dockerfile should not use uv.lock as the production dependency source",
);

const backendRequirements = read("backend/requirements.txt");
assert(
  backendRequirements.includes("psycopg[binary]>=3.2.0"),
  "backend requirements should include the PostgreSQL driver",
);

const frontendDockerfile = read("frontend/Dockerfile");
assert(
  frontendDockerfile.includes("npm ci") && frontendDockerfile.includes("next"),
  "frontend Dockerfile should build the Next.js standalone app",
);

const caddyfile = read("deploy/caddy/Caddyfile");
for (const route of ["/api/*", "/uploads/*", "/health", "reverse_proxy frontend:3000"]) {
  assert(caddyfile.includes(route), `Caddyfile should route ${route}`);
}

console.log("Docker compose configuration checks passed.");
