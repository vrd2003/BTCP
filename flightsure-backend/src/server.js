import http from 'node:http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';
import { startFlightMonitor } from './workers/flightMonitor.js';

async function start() {
  const config = loadConfig();
  mongoose.set('sanitizeFilter', true);
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const app = createApp(config, mongoose.connection);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.socketOrigins, credentials: true },
    maxHttpBufferSize: 1e6
  });
  attachSockets(io, config);
  const monitor = startFlightMonitor(io, config);
  server.listen(config.PORT, () => {
    console.log(JSON.stringify({ level: 'info', event: 'server_started', port: config.PORT, environment: config.NODE_ENV }));
  });

  const shutdown = async signal => {
    console.log(JSON.stringify({ level: 'info', event: 'server_shutdown', signal }));
    monitor.stop();
    io.close();
    await mongoose.disconnect();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(error => {
  console.error(JSON.stringify({ level: 'fatal', event: 'server_start_failed', message: error.message }));
  process.exitCode = 1;
});
