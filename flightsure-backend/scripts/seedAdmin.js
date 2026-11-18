import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { loadConfig } from '../src/config/env.js';
import User from '../src/models/User.js';

async function seedAdmin() {
  const config = loadConfig();
  if (!config.ADMIN_BOOTSTRAP_EMAIL || !config.ADMIN_BOOTSTRAP_PASSWORD) {
    throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before running the bootstrap script.');
  }
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const email = config.ADMIN_BOOTSTRAP_EMAIL.toLowerCase();
  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing) {
    if (existing.role !== 'Admin') {
      throw new Error('The configured bootstrap email already belongs to a non-admin user; refusing to promote it.');
    }
    console.log('The configured admin account already exists; no changes were made.');
    return;
  }
  const passwordHash = await bcrypt.hash(config.ADMIN_BOOTSTRAP_PASSWORD, 12);
  await User.create({ name: 'FlightSure Administrator', email, passwordHash, role: 'Admin' });
  console.log(`Created the FlightSure admin account for ${email}.`);
}

seedAdmin()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
