import mongoose from "mongoose";
import { User } from "./src/models/User";
import { env } from "./src/config/env";

async function check() {
  await mongoose.connect(env.MONGODB_URI);
  const users = await User.find({}).sort({createdAt: -1}).limit(5);
  for (const user of users) {
    console.log(`User: ${user.email}, Plan: ${user.plan}, Status: ${user.subscriptionStatus}, SubsId: ${user.polarSubscriptionId}`);
  }
  process.exit(0);
}
check();
