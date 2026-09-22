import { apiApp } from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

export function startApiServer() {
  const server = apiApp.listen(PORT, () => {
    console.log(`[AI Workbench Control Plane API] Running on port ${PORT}`);
  });
  return server;
}

if (process.env.NODE_ENV !== "test" && typeof window === "undefined") {
  startApiServer();
}
