import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getAddress, verifyMessage } from 'ethers';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';

function accessToken(user, config) {
  return jwt.sign(
    { sub: user.id, role: user.role, tokenVersion: user.tokenVersion },
    config.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: config.JWT_ACCESS_TTL }
  );
}

export async function register(request, response) {
  const { name, email, password } = request.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
  const token = accessToken(user, request.app.locals.config);
  await AuditLog.create({
    actorId: user._id, action: 'AUTH_REGISTER', resourceType: 'User',
    resourceId: user.id, requestId: request.id, outcome: 'SUCCESS'
  });
  return sendSuccess(response, 201, 'Account created.', { user, accessToken: token, tokenType: 'Bearer' });
}

export async function login(request, response) {
  const user = await User.findOne({ email: request.body.email.toLowerCase() }).select('+passwordHash +tokenVersion');
  const passwordMatches = user ? await bcrypt.compare(request.body.password, user.passwordHash) : false;
  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  await AuditLog.create({
    actorId: user._id, action: 'AUTH_LOGIN', resourceType: 'User',
    resourceId: user.id, requestId: request.id, outcome: 'SUCCESS'
  });
  return sendSuccess(response, 200, 'Signed in.', {
    user, accessToken: accessToken(user, request.app.locals.config), tokenType: 'Bearer'
  });
}

export async function logout(request, response) {
  request.user.tokenVersion += 1;
  await request.user.save();
  await AuditLog.create({
    actorId: request.user._id, action: 'AUTH_LOGOUT', resourceType: 'User',
    resourceId: request.user.id, requestId: request.id, outcome: 'SUCCESS'
  });
  return sendSuccess(response, 200, 'Session invalidated.', {});
}

export async function me(request, response) {
  return sendSuccess(response, 200, 'Authenticated user.', { user: request.user });
}

export async function updateProfile(request, response) {
  request.user.name = request.body.name;
  await request.user.save();
  await AuditLog.create({
    actorId: request.user._id, action: 'PROFILE_UPDATE', resourceType: 'User',
    resourceId: request.user.id, requestId: request.id, outcome: 'SUCCESS'
  });
  return sendSuccess(response, 200, 'Profile updated.', { user: request.user });
}

export async function createWalletNonce(request, response) {
  const address = getAddress(request.body.address);
  const nonce = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await User.updateOne(
    { _id: request.user._id },
    { $set: { walletNonce: nonce, walletNonceExpiresAt: expiresAt } },
    { runValidators: true }
  );
  const message = [
    'FlightSure wallet ownership verification',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt.toISOString()}`
  ].join('\n');
  return sendSuccess(response, 200, 'Sign this one-time message in your wallet.', { message, expiresAt });
}

export async function verifyWallet(request, response) {
  const address = getAddress(request.body.address);
  const user = await User.findById(request.user._id).select('+walletNonce +walletNonceExpiresAt').lean();
  if (!user.walletNonce || !user.walletNonceExpiresAt || user.walletNonceExpiresAt <= new Date()) {
    throw new AppError(400, 'WALLET_NONCE_EXPIRED', 'Request a new wallet verification message.');
  }
  const message = [
    'FlightSure wallet ownership verification',
    `Address: ${address}`,
    `Nonce: ${user.walletNonce}`,
    `Expires: ${user.walletNonceExpiresAt.toISOString()}`
  ].join('\n');
  let signer;
  try {
    signer = getAddress(verifyMessage(message, request.body.signature));
  } catch {
    throw new AppError(400, 'INVALID_WALLET_SIGNATURE', 'The wallet signature could not be verified.');
  }
  if (signer !== address) {
    throw new AppError(401, 'WALLET_ADDRESS_MISMATCH', 'The signature does not match the requested wallet.');
  }
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      walletNonce: user.walletNonce,
      walletNonceExpiresAt: mongoose.trusted({ $gt: new Date() })
    },
    { $set: { walletAddress: address }, $unset: { walletNonce: 1, walletNonceExpiresAt: 1 } },
    { new: true, runValidators: true }
  );
  if (!updatedUser) {
    throw new AppError(409, 'WALLET_NONCE_ALREADY_USED', 'Request a new wallet verification message.');
  }
  await AuditLog.create({
    actorId: user._id, action: 'WALLET_LINK', resourceType: 'User',
    resourceId: user.id, requestId: request.id, outcome: 'SUCCESS'
  });
  return sendSuccess(response, 200, 'Wallet ownership verified.', { user: updatedUser });
}
